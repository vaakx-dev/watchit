#[derive(Clone, Debug)]
pub(crate) struct SourceError {
    pub status: u16,
    pub message: String,
    pub retry_after: Option<u64>,
}

impl SourceError {
    pub fn new(status: u16, message: impl Into<String>) -> Self {
        Self { status, message: message.into(), retry_after: None }
    }

    pub fn missing() -> Self {
        Self::new(404, "This title is not available from Cinemeta.")
    }

    pub fn rejected(&self) -> bool {
        self.status == 400 || self.status == 404
    }
}
