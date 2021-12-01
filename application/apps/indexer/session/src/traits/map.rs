use std::ops::Range;

pub struct Map {
    /// Vector of positions in file
    ///      (byte,  row  )
    map: Vec<(usize, usize)>,
}

impl Map {
    pub fn new() -> Self {
        Self { map: vec![] }
    }

    pub fn push(&mut self, bytes: usize, rows: usize) {
        self.map.push((bytes, rows));
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
}
