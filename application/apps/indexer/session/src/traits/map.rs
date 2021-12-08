use std::ops::Range;

pub struct Map {
    /// Vector of positions in file
    ///      (byte,  row  )
    map: Vec<(usize, usize)>,
    bytes: usize,
    rows: usize,
}

impl Map {
    pub fn new() -> Self {
        Self {
            map: vec![],
            bytes: 0,
            rows: 0,
        }
    }

    pub fn push(&mut self, bytes: usize, rows: usize) {
        self.bytes += bytes;
        self.rows += rows;
        self.map.push((self.bytes, self.rows));
    }

    pub fn get_rows_count(&self) -> usize {
        if self.map.len() > 0 {
            self.map[self.map.len() - 1].1
        } else {
            0
        }
    }

    /// Returns bytyes & rows ranges considering to passed rows range
    /// (bytes_range,  rows_range  )
    /// (Range<usize>, Range<usize>)
    pub fn get_bytes_range(&self, rows: &Range<usize>) -> Option<(Range<usize>, Range<usize>)> {
        let before = self
            .map
            .iter()
            .position(|(_byte, row)| *row >= rows.start)?;
        let after = self.map.iter().position(|(_byte, row)| *row >= rows.end)?;
        let start = if before >= 1 {
            self.map[before - 1]
        } else {
            self.map[before]
        };
        let end = self.map[after];
        Some((
            Range {
                start: start.0,
                end: end.0,
            },
            Range {
                start: start.1,
                end: end.1,
            },
        ))
    }

    pub fn report(&self) -> String {
        let len = self.map.len();
        let mut output = String::new();
        output = format!("{}slots: {}", output, len);
        output = format!(
            "{}\nbytes: {}",
            output,
            if len > 0 { self.map[len - 1].0 } else { 0 }
        );
        output = format!(
            "{}\nrows: {}",
            output,
            if len > 0 { self.map[len - 1].1 } else { 0 }
        );
        output
    }
}
