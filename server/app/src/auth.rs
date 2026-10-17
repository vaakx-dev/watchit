use axum::extract::{Request, State};
use axum::http::Method;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use watchit_core::{AppResult, SESSION_HEADER, StreamTokens, Viewer};
use watchit_profiles::Profiles;

#[derive(Clone)]
pub struct Auth {
    pub profiles: Profiles,
    pub tokens: StreamTokens,
}

fn stream_token(request: &Request) -> Option<String> {
    let query = request.uri().query()?;
    form_urlencoded::parse(query.as_bytes()).find(|(key, _)| key == "token").map(|(_, value)| value.into_owned())
}

enum Credential {
    Session(String),
    StreamToken(i64),
}

impl Auth {
    fn credential(&self, request: &Request) -> Option<Credential> {
        if let Some(session) = request.headers().get(SESSION_HEADER) {
            return Some(Credential::Session(session.to_str().ok()?.to_owned()));
        }
        if !matches!(*request.method(), Method::GET | Method::HEAD) {
            return None;
        }
        let token = stream_token(request)?;
        self.tokens.verify(&token, request.uri().path()).map(Credential::StreamToken)
    }

    async fn viewer(&self, credential: Credential) -> AppResult<Option<Viewer>> {
        match credential {
            Credential::Session(token) => self.profiles.session_viewer(token).await,
            Credential::StreamToken(profile) => self.profiles.viewer(profile).await,
        }
    }
}

pub async fn authenticate(State(auth): State<Auth>, mut request: Request, next: Next) -> Response {
    let Some(credential) = auth.credential(&request) else { return next.run(request).await };
    match auth.viewer(credential).await {
        Ok(Some(viewer)) => {
            request.extensions_mut().insert(viewer);
        }
        Ok(None) => {}
        Err(error) => return error.into_response(),
    }
    next.run(request).await
}

pub async fn require_viewer(_: Viewer, request: Request, next: Next) -> Response {
    next.run(request).await
}
