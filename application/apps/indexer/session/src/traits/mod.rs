mod buffer; //-------| struct
            //       |<= shared grabber's functionality
mod collector; //----| struct
               //
mod error; //        Common trait for errors
mod map; //          File (parsed/text) map holder | struct
mod parser; //       Parser trait
mod parsers;
mod source; //       Source trait
mod sources;
#[cfg(test)]
mod tests;
