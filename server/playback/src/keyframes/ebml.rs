#[derive(Clone, Copy, Debug)]
pub struct Element {
    pub id: u64,
    pub start: usize,
    pub end: usize,
}

fn vint(bytes: &[u8], position: usize, keep_marker: bool) -> Option<(u64, usize)> {
    let first = *bytes.get(position)?;
    if first == 0 {
        return None;
    }
    let length = first.leading_zeros() as usize + 1;
    let tail = bytes.get(position + 1..position + length)?;
    let head = if keep_marker { u64::from(first) } else { u64::from(first & (0xff >> length)) };
    Some((tail.iter().fold(head, |value, byte| (value << 8) | u64::from(*byte)), length))
}

pub fn element_at(bytes: &[u8], position: usize) -> Option<Element> {
    let (id, id_length) = vint(bytes, position, true)?;
    let (size, size_length) = vint(bytes, position + id_length, false)?;
    let start = position + id_length + size_length;
    let end = start.saturating_add(usize::try_from(size).ok()?);
    Some(Element { id, start, end })
}

pub fn children(bytes: &[u8], parent: Element) -> Vec<Element> {
    let end = parent.end.min(bytes.len());
    let mut found = Vec::new();
    let mut position = parent.start;
    while position < end {
        let Some(element) = element_at(bytes, position) else { break };
        found.push(element);
        position = element.end;
    }
    found
}

pub fn unsigned(bytes: &[u8], element: Element) -> u64 {
    bytes[element.start..element.end.min(bytes.len())].iter().fold(0, |value, byte| (value << 8) | u64::from(*byte))
}

pub fn child_value(bytes: &[u8], parent: Element, id: u64) -> Option<u64> {
    children(bytes, parent).into_iter().find(|element| element.id == id).map(|element| unsigned(bytes, element))
}
