use qrcode::QrCode;
use qrcode::render::svg;

pub fn svg_for(url: &str) -> Option<String> {
    let code = QrCode::new(url.as_bytes()).ok()?;
    Some(
        code.render::<svg::Color>()
            .min_dimensions(224, 224)
            .dark_color(svg::Color("#000"))
            .light_color(svg::Color("#fff"))
            .build(),
    )
}
