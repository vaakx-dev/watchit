use super::{Quality, Stance};
use crate::release::{Hdr, Resolution};
use crate::search::Candidate;

const UNKNOWN_RESOLUTION: u8 = 99;
const ABOVE_PREFERRED: u8 = 10;
const ASSUMED_LANGUAGE: &str = "en";

fn primary(code: &str) -> &str {
    code.split('-').next().unwrap_or(code)
}

impl Quality {
    pub fn admits(&self, candidate: &Candidate) -> bool {
        let too_large = self
            .max_size_bytes
            .zip(candidate.result.size_bytes)
            .is_some_and(|(limit, size)| size > limit);
        !(too_large || (self.hide_cam && candidate.traits.cam))
    }

    pub fn resolution_rank(&self, resolution: Option<Resolution>) -> u8 {
        let Some(resolution) = resolution else { return UNKNOWN_RESOLUTION };
        let (found, wanted) = (resolution as u8, self.resolution as u8);
        if found >= wanted {
            found - wanted
        } else {
            ABOVE_PREFERRED + wanted - found
        }
    }

    pub fn avoids(&self, candidate: &Candidate) -> bool {
        let hdr = &candidate.result.hdr;
        (self.hdr == Stance::Avoid && !hdr.is_empty())
            || (self.dolby_vision == Stance::Avoid && hdr.contains(&Hdr::DolbyVision))
            || !self.speaks(candidate)
    }

    pub fn likes(&self, candidate: &Candidate) -> bool {
        let hdr = &candidate.result.hdr;
        (self.hdr == Stance::Prefer && !hdr.is_empty()) || (self.dolby_vision == Stance::Prefer && hdr.contains(&Hdr::DolbyVision))
    }

    fn speaks(&self, candidate: &Candidate) -> bool {
        if self.languages.is_empty() {
            return true;
        }
        let spoken = &candidate.result.languages;
        let assumed = [ASSUMED_LANGUAGE.to_owned()];
        let spoken = if spoken.is_empty() { &assumed[..] } else { &spoken[..] };
        spoken.iter().any(|language| {
            self.languages
                .iter()
                .any(|wanted| primary(wanted).eq_ignore_ascii_case(primary(language)))
        })
    }
}
