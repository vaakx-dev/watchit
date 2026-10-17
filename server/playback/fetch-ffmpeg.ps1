$ErrorActionPreference = 'Stop'

$version = '8.1.3-1'
$sha256 = '3691f8b2d4c39c511b5faff1c8c4687bd782dac823e63ba69f0755f7ce1af9ce'
$asset = "jellyfin-ffmpeg_${version}_portable_win64-clang-gpl.zip"
$url = "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v$version/$asset"
$target = Join-Path $PSScriptRoot 'resources\ffmpeg'
$stamp = Join-Path $target 'version.txt'

if ((Test-Path $stamp) -and ((Get-Content $stamp) -eq $version)) {
    Write-Host "jellyfin-ffmpeg $version is already in $target"
    exit 0
}

$zip = Join-Path ([System.IO.Path]::GetTempPath()) $asset
Invoke-WebRequest -Uri $url -OutFile $zip
$actual = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
if ($actual -ne $sha256) {
    Remove-Item $zip
    throw "Checksum mismatch for ${asset}: $actual"
}

if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Force $target | Out-Null
Expand-Archive -Path $zip -DestinationPath $target
Remove-Item $zip
Set-Content -Path $stamp -Value $version
Write-Host "jellyfin-ffmpeg $version is in $target"
