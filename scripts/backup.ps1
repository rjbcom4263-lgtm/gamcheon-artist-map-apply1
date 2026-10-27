# 감천 작가 지도 — 운영 데이터 백업 (Windows)
#
# 사용법 (프로젝트 폴더에서):
#   npm run backup                 # D1 전체를 backups/d1-<날짜>.sql 로 내보내고, rclone이 있으면 R2도 받습니다
#   npm run backup -- -SkipR2      # D1만
#
# R2(작품 이미지) 백업은 rclone(https://rclone.org)이 설치되어 있고 "gamcheon-r2"라는 S3 호환 remote가
# 설정되어 있을 때만 받습니다. 설정 방법은 README의 "운영 환경" 절을 보세요.
# backups/ 폴더는 .gitignore에 있습니다. 개인정보가 들어 있으니 안전한 곳에 옮기고 복사본을 정리하세요.

param(
  [switch]$SkipR2,
  [string]$OutDir = "backups"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dbName = "gamcheon-artist-map-apply-db"
$bucketName = "gamcheon-artist-map-apply-images"
$rcloneRemote = "gamcheon-r2"

function Invoke-Checked {
  param([string]$Label, [scriptblock]$Command)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "$Label 실패 (exit $LASTEXITCODE)" }
  Write-Host "[backup] $Label 완료"
}

# 한글 경로에서는 wrangler가 죽으므로 deploy.ps1과 같은 방식으로 드라이브 문자에 매핑합니다.
$mappedDrive = $null
$workRoot = $projectRoot
if ($projectRoot -match '[^\x00-\x7F]') {
  $used = (Get-PSDrive -PSProvider FileSystem).Name
  $letter = "GHIJKLMNOPQRSTUVWXYZ".ToCharArray() | Where-Object { $used -notcontains [string]$_ } | Select-Object -First 1
  if (-not $letter) { throw "비어 있는 드라이브 문자가 없습니다." }
  subst "${letter}:" $projectRoot
  $mappedDrive = [string]$letter
  $workRoot = "${letter}:\"
  Write-Host "[backup] 한글 경로를 피해 ${letter}: 에 매핑했습니다"
}

Push-Location $workRoot
try {
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  $sqlPath = Join-Path $OutDir "d1-$stamp.sql"
  Invoke-Checked "D1 내보내기 → $sqlPath" { node node_modules\wrangler\bin\wrangler.js d1 export $dbName --remote --output $sqlPath }
  # gps_trails(운영자가 올린 GPS 이동 기록)는 개인정보라 백업에서 뺍니다. 지도 골목은 map_alleys에 따로 저장되어 있어
  # 복원에 영향이 없습니다. 테이블 정의(CREATE TABLE)는 남기고 INSERT 줄만 지웁니다.
  $lines = Get-Content $sqlPath
  $kept = $lines | Where-Object { $_ -notmatch '^\s*INSERT INTO "?gps_trails"?' }
  $removed = $lines.Count - $kept.Count
  Set-Content -Path $sqlPath -Value $kept -Encoding utf8
  if ($removed -gt 0) { Write-Host "[backup] gps_trails 행 $removed 개를 백업에서 제외했습니다" }
  $size = (Get-Item $sqlPath).Length
  Write-Host ("[backup] D1 백업 크기: {0:N0} bytes" -f $size)

  if ($SkipR2) {
    Write-Host "[backup] R2 건너뜀(-SkipR2)"
  } elseif (Get-Command rclone -ErrorAction SilentlyContinue) {
    $r2Dir = Join-Path $OutDir "r2-$stamp"
    Invoke-Checked "R2 내려받기 → $r2Dir" { rclone sync "${rcloneRemote}:$bucketName" $r2Dir --progress }
  } else {
    Write-Host "[backup] rclone이 없어 R2(작품 이미지)는 받지 않았습니다. README의 운영 환경 절을 보고 rclone remote '$rcloneRemote'를 설정하세요."
  }
  Write-Host "[backup] 끝. 결과: $(Join-Path $projectRoot $OutDir)"
}
finally {
  Pop-Location
  if ($mappedDrive) { subst "${mappedDrive}:" /D | Out-Null }
}
