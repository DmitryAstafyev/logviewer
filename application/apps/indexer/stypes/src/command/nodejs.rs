use crate::*;

try_into_js!(CommandOutcome<FoldersScanningResult>);
try_into_js!(CommandOutcome<SerialPortsList>);
try_into_js!(CommandOutcome<()>);
try_into_js!(CommandOutcome<i64>);
try_into_js!(CommandOutcome<Option<String>>);
try_into_js!(CommandOutcome<String>);
try_into_js!(CommandOutcome<bool>);