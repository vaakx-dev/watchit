use libmpv2::Mpv;

const OPTIONS: &[(&str, &str)] = &[
    ("gpu-context", "d3d11"),
    ("d3d11-output-format", "auto"),
    ("d3d11-output-csp", "auto"),
    ("target-colorspace-hint", "auto"),
    ("target-colorspace-hint-mode", "target"),
    ("tone-mapping", "bt.2390"),
    ("dither-depth", "auto"),
    ("deband", "yes"),
    ("scale", "spline36"),
    ("cscale", "spline36"),
    ("keep-open", "yes"),
    ("input-default-bindings", "no"),
    ("input-vo-keyboard", "no"),
    ("osc", "no"),
];

pub fn create(wid: isize) -> Mpv {
    Mpv::with_initializer(|init| {
        init.set_property("wid", wid as i64)?;
        init.set_property("title", "Watchit")?;
        init.set_property("audio-client-name", "Watchit")?;
        init.set_property("terminal", "yes")?;
        init.set_property("msg-level", "all=warn,cplayer=info,vo=info")?;
        init.set_property("hwdec", "auto")?;
        init.set_property("vo", "gpu-next,gpu,")?;
        for (name, value) in OPTIONS {
            if let Err(error) = init.set_property(name, *value) {
                eprintln!("mpv: cannot set {name}={value}: {error:?}");
            }
        }
        Ok(())
    })
    .expect("cannot build mpv")
}
