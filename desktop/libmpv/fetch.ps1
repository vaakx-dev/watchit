$ErrorActionPreference = "Stop"
$tag = "2026-10-16-dde0671072"
$asset = "mpv-dev-x86_64-20261016-git-dde0671072.7z"
$expected = "dc4cdf9baa7f613bccdf8d65cbde8203cab0095c30472683bdf78517fff8576c"

$here = $PSScriptRoot
$archive = Join-Path $here $asset
if (-not (Test-Path (Join-Path $here "libmpv-2.dll"))) {
    Invoke-WebRequest "https://github.com/zhongfly/mpv-winbuild/releases/download/$tag/$asset" -OutFile $archive
    $actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) { throw "checksum mismatch for $asset" }
    7z x $archive "-o$here" -y libmpv-2.dll | Out-Null
    Remove-Item $archive
}
