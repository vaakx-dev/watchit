use libmpv2::Format;
use serde_json::Value;
use tauri::State;

use super::Player;
use super::events::format_of;

#[tauri::command]
pub fn mpv_message(player: State<Player>, msg: Value) -> Result<(), String> {
    player.handle(&msg)
}

impl Player {
    fn handle(&self, msg: &Value) -> Result<(), String> {
        let name = msg.get(0).and_then(Value::as_str).ok_or("missing function")?;
        let args = msg.get(1).ok_or("missing args")?;
        match name {
            "mpv-observe-prop" => self.observe_property(args),
            "mpv-set-prop" => self.set_property(args),
            "mpv-command" => self.command(args),
            other => Err(format!("unsupported message {other}")),
        }
    }

    fn observe_property(&self, args: &Value) -> Result<(), String> {
        let prop = args.as_str().ok_or("prop must be a string")?;
        let format: Format = format_of(prop);
        self.observe
            .lock()
            .unwrap()
            .send((prop.to_string(), format))
            .map_err(|error| error.to_string())
    }

    fn set_property(&self, args: &Value) -> Result<(), String> {
        let prop = args.get(0).and_then(Value::as_str).ok_or("missing prop")?;
        let result = match args.get(1) {
            Some(Value::Bool(value)) => self.mpv.set_property(prop, *value),
            Some(Value::Number(value)) => self.mpv.set_property(prop, value.as_f64().unwrap_or(0.0)),
            Some(Value::String(value)) => self.mpv.set_property(prop, value.as_str()),
            _ => return Err("unsupported value".into()),
        };
        result.map_err(|error| error.to_string())
    }

    fn command(&self, args: &Value) -> Result<(), String> {
        let parts: Vec<String> = args
            .as_array()
            .ok_or("command must be an array")?
            .iter()
            .map(|part| part.as_str().map(String::from).unwrap_or_else(|| part.to_string()))
            .collect();
        let (command, rest) = parts.split_first().ok_or("empty command")?;
        let rest: Vec<&str> = rest.iter().map(String::as_str).collect();
        self.mpv.command(command, &rest).map_err(|error| error.to_string())
    }
}
