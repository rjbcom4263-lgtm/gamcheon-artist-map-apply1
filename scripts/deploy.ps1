# 감천 작가 지도 — Windows 빌드·배포 스크립트
#
# 사용법 (프로젝트 폴더에서):
#   npm run deploy                 # 설치(필요할 때만) → 빌드 → Cloudflare 배포
#   npm run deploy -- -BuildOnly   # 빌드까지만
#   npm run deploy -- -SkipInstall # npm ci 건너뛰기
#
# 왜 드라이브 문자로 매핑하나?
#   프로젝트 폴더 경로에 한글(예: ...\Desktop\이거)이 들어가면 이 PC의 Node 22에서
#   wrangler·vinext가 접근 위반(0xC0000005)으로 바로 종료됩니다. 같은 폴더를 subst로
#   빈 드라이브 문자(G: 등)에 매핑해 ASCII 경로로 실행하면 정상 동작합니다.
#   경로가 전부 ASCII면 매핑 없이 그 자리에서 실행합니다.

param(
  [switch]$BuildOnly,
  [switch]$SkipInstall,
  [string]$Drive = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
  param([string]$Label, [scriptblock]$Command)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  # Windows PowerShell 5.1은 외부 명령의 stderr(예: Node 경고)를 오류로 취급하므로
  # 실행 중에는 Continue로 두고, 성공 여부는 종료 코드로만 판단합니다.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command 2>&1 | ForEach-Object { "$_" }
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($LASTEXITCODE -ne 0) {
    throw "$Label 실패 (exit $LASTEXITCODE)"
  }
  Write-Host ("[deploy] {0} 완료 ({1}초)" -f $Label, [int]$sw.Elapsed.TotalSeconds)
}

function Get-FreeDriveLetter {
  $used = (Get-PSDrive -PSProvider FileSystem).Name
  foreach ($letter in "GHIJKLMNOPQRSTUVWXYZ".ToCharArray()) {
    if ($used -notcontains [string]$letter) { return [string]$letter }
  }
  throw "비어 있는 드라이브 문자가 없습니다."
}

$needsMapping = $projectRoot -match '[^\x00-\x7F]'
$mappedDrive = $null
$workRoot = $projectRoot

if ($needsMapping) {
  if ($Drive -eq "") { $Drive = Get-FreeDriveLetter }
  $Drive = $Drive.TrimEnd(':').ToUpper()
  if (Test-Path "${Drive}:\") {
    throw "${Drive}: 드라이브가 이미 사용 중입니다. -Drive 로 다른 문자를 지정하세요."
  }
  subst "${Drive}:" $projectRoot
  if ($LASTEXITCODE -ne 0) { throw "subst ${Drive}: 실패" }
  $mappedDrive = $Drive
  $workRoot = "${Drive}:\"
  Write-Host "[deploy] 한글 경로를 피해 ${Drive}: 에 매핑했습니다 → $projectRoot"
}

Push-Location $workRoot
try {
  # 1. 의존성: package-lock.json 해시가 마지막 설치와 다를 때만 npm ci
  $lockHash = (Get-FileHash package-lock.json -Algorithm SHA256).Hash
  $marker = "node_modules\.deploy-lockfile-sha256"
  $installed = (Test-Path node_modules\vinext\dist\cli.js) -and (Test-Path $marker) -and ((Get-Content $marker -Raw).Trim() -eq $lockHash)
  if ($SkipInstall) {
    Write-Host "[deploy] npm ci 건너뜀(-SkipInstall)"
  } elseif ($installed) {
    Write-Host "[deploy] 의존성이 lockfile과 일치해 npm ci 건너뜀"
  } else {
    Invoke-Checked "npm ci" { npm ci --no-audit --no-fund }
    Set-Content -Path $marker -Value $lockHash -Encoding ascii
  }

  # 2. 빌드
  Invoke-Checked "vinext build" { node node_modules\vinext\dist\cli.js build }

  if ($BuildOnly) {
    Write-Host "[deploy] -BuildOnly: 배포는 하지 않았습니다. 산출물: dist\"
    return
  }

  # 3. 배포 (계정 확인 → deploy)
  Invoke-Checked "wrangler whoami" { node node_modules\wrangler\bin\wrangler.js whoami }
  Invoke-Checked "wrangler deploy" { node node_modules\wrangler\bin\wrangler.js deploy }
  Write-Host "[deploy] 배포 완료: https://artist-map.com/"
}
finally {
  Pop-Location
  if ($mappedDrive) {
    subst "${mappedDrive}:" /D | Out-Null
    Write-Host "[deploy] ${mappedDrive}: 매핑 해제"
  }
}
