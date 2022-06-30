use crate::{duration_report, Instant};
use futures::{pin_mut, stream::StreamExt};
use parsers::{dlt::DltParser, MessageStreamItem};
use processor::grabber::LineRange;
use rustyline::{error::ReadlineError, Editor};
use session::session::Session;
use sources::{
    factory::{DltParserSettings, ParserType, SourceType},
    producer::MessageProducer,
    socket::udp::UdpSource,
};
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

use tokio::{select, sync::mpsc, task, task::JoinHandle};

use uuid::Uuid;

pub(crate) async fn handle_interactive_session(matches: &clap::ArgMatches) {
    let uuid = Uuid::new_v4();
    let (session, mut receiver) = Session::new(uuid).await;
    let (tx, mut rx) = mpsc::unbounded_channel();
    let cancel = CancellationToken::new();

    collect_user_input(tx).await;
    let mut start = Instant::now();
    loop {
        select! {
            command = rx.recv() => {
                match command {
                    Some(Command::Help) => {
                        println!("supported commands are:");
                        println!("  observe -> start observing the file that has been given as input");
                        println!("  dlt -> start observing the dlt file that has been given as input");
                        println!("  udp -> start listening to udp server on port 5000");
                        println!("  grab -> after observing a file we can grab lines with this command");
                        println!("  stop -> exit the interpreter");
                    }
                    Some(Command::Udp) => {
                        println!("udp command received");
                        start = Instant::now();
                        let cancel = cancel.clone();
                        let _ = tokio::spawn(async move {
                        static RECEIVER: &str = "127.0.0.1:5000";
                            let udp_source = UdpSource::new(RECEIVER, vec![]).await.unwrap();
                            let dlt_parser = DltParser::new(None, None, false);
                            let mut dlt_msg_producer = MessageProducer::new(dlt_parser, udp_source);
                            let msg_stream = dlt_msg_producer.as_stream();
                            pin_mut!(msg_stream);
                            loop {
                                select! {
                                    _ = cancel.cancelled() => {
                                        println!("received shutdown through future channel");
                                        break;
                                    }
                                    item = msg_stream.next() => {
                                        match item {
                                            Some((_, MessageStreamItem::Item(msg))) => {
                                                println!("msg: {}", msg);
                                            }
                                            _ => println!("no msg"),
                                        }
                                    }
                                }
                            }
                            println!("Udp finished");
                        });
                    }
                    Some(Command::Observe) => {
                        println!("observe command received");
                        start = Instant::now();
                        let uuid = Uuid::new_v4();
                        let file_name = matches.value_of("input").expect("input must be present");
                        let file_path = PathBuf::from(file_name);
                        let source = SourceType::File(file_path.clone(), ParserType::Text);
                        session.observe(uuid, source).expect("observe failed");
                    }
                    Some(Command::Dlt) => {
                        println!("dlt command received");
                        start = Instant::now();
                        let uuid = Uuid::new_v4();
                        let file_name = matches.value_of("input").expect("input must be present");
                        println!("trying to read {:?}", file_name);
                        let file_path = PathBuf::from(file_name);
                        let dlt_parser_settings = DltParserSettings { filter_config: None, fibex_file_paths: None, with_storage_header: true};
                        let source = SourceType::File(file_path.clone(), ParserType::Dlt(dlt_parser_settings));
                        session.observe(uuid, source).expect("observe failed");
                        println!("dlt session was destroyed");
                    }
                    Some(Command::Grab) => {
                        println!("grab command received");
                        start = Instant::now();
                        let start_op = Instant::now();
                        let content = session.grab(LineRange::from(0u64..=1000)).await.expect("grab failed");
                        let len = content.grabbed_elements.len();
                        println!("content has {} elemenst", len);
                        for elem in content.grabbed_elements {
                            println!("{:?}", elem);
                        }
                        duration_report(start_op, format!("grabbing {} lines", len));
                    }
                    Some(Command::Stop) => {
                        println!("stop command received");
                        start = Instant::now();
                        cancel.cancel();
                        session.stop(uuid).await.unwrap();
                    }
                    None => {
                        println!("None command");
                        break;
                    }
                }
            }
            feedback = receiver.recv() => {
                if let Some(feedback) = feedback {
                    let elapsed = start.elapsed().as_millis();
                    println!("got session feedback after {} ms: {:?}", elapsed, feedback);
                } else {
                    println!("no more feedback comming");
                    break;
                }
            }
        }
    }
    println!("end of handle_interactive_session()");

    let stop_uuid = Uuid::new_v4();
    session.stop(stop_uuid).await.unwrap();
}

#[derive(Debug)]
enum Command {
    Observe,
    Dlt,
    Grab,
    Udp,
    Stop,
    Help,
}

async fn collect_user_input(tx: mpsc::UnboundedSender<Command>) -> JoinHandle<()> {
    task::spawn_blocking(move || {
        let mut rl = Editor::<()>::new();
        loop {
            let readline = rl.readline(">> ");
            match readline {
                Ok(line) => match line.as_str().to_lowercase().as_str() {
                    "observe" => {
                        tx.send(Command::Observe).expect("send failed");
                    }
                    "dlt" => {
                        tx.send(Command::Dlt).expect("send failed");
                    }
                    "stop" => {
                        tx.send(Command::Stop).expect("send failed");
                        break;
                    }
                    "udp" => {
                        tx.send(Command::Udp).expect("send failed");
                    }
                    "grab" => {
                        tx.send(Command::Grab).expect("send failed");
                    }
                    "help" => {
                        tx.send(Command::Help).expect("send failed");
                    }
                    "exit" => {
                        println!("got exit");
                        break;
                    }
                    x => {
                        println!("unknown command: {}", x);
                    }
                },
                Err(ReadlineError::Interrupted) => {
                    println!("CTRL-C");
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
                Err(ReadlineError::Eof) => {
                    println!("CTRL-D");
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
                Err(err) => {
                    println!("Error: {:?}", err);
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
            }
        }
        println!("done with readline loop");
    })
}