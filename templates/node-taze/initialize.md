# node-taze 초기화 가이드

taze는 Node.js 패키지 의존성 버전 업데이트 CLI 도구입니다.

## 폴더 트리 구조

```
src/
  commands/check/
    index.ts          # 로컬 패키지 체크 엔트리
    checkGlobal.ts    # 글로벌 패키지 체크
    interactive.ts    # 터미널 인터랙티브 UI
    render.ts         # 결과 렌더링
  api/
    index.ts          # CheckPackages, CheckSingleProject
  io/
    package.ts        # loadPackage, writePackage (분기 진입점)
    packageJSON.ts / packageYAML.ts / pnpmWorkspace.ts / ...
    dependencies.ts   # parseDependencies, dumpDependencies
  utils/
    config.ts / diff.ts / npm.ts / versions.ts / sort.ts
  addons/
    index.ts          # builtinAddons
    vscode.ts         # addonVSCode
  types.ts            # 공통 타입 정의
```

## 새 기능 추가 시 작업 순서

1. `src/types.ts` - 타입/인터페이스 추가
2. `src/io/` - 패키지 포맷 로더/라이터 추가
3. `src/api/` - `CheckPackages` 콜백 확장
4. `src/commands/check/` - 렌더링 및 엔트리 로직 추가
5. `src/addons/` - 후처리 애드온 추가 (선택)

## 구획별 핵심 코드 스니펫

**commands** - 체크 플로우 진입:
```ts
const bars = options.loglevel === 'silent' ? null : createMultiProgressBar()
await CheckPackages(options, {
  onDependencyResolved(_pkgName, _name, progress) { depBar?.update(progress) },
})
bars?.stop()
```

**api** - 콜백 인터페이스:
```ts
export interface CheckEventCallbacks {
  afterPackagesLoaded?: (pkgs: PackageMeta[]) => void
  beforePackageWrite?: (pkg: PackageMeta) => boolean | Promise<boolean>
  onDependencyResolved?: DependencyResolvedCallback
}
```

**io** - 포맷별 분기 라이터:
```ts
export async function writePackage(pkg: PackageMeta, options: CommonOptions) {
  switch (pkg.type) {
    case 'package.json': return writePackageJSON(pkg, options)
    case 'package.yaml': return writePackageYAML(pkg, options)
    default: throw new Error(`Unsupported package type: ${pkg.type}`)
  }
}
```

**utils** - 타임아웃 포함 네트워크 호출:
```ts
const data = await Promise.race([
  getVersions(spec, { force, fetch, throw: false, metadata: true }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
])
```

**addons** - 쓰기 전 후처리:
```ts
export const addonVSCode: Addon = {
  beforeWrite(pkg) {
    if (!pkg.raw?.engines?.vscode) return
    // engines.vscode 버전 동기화
  },
}
```

## rules/ 파일 목록

| 파일 | 경로 | 용도 |
|------|------|------|
| `src-commands.md` | `src/commands/**` | 체크 명령 패턴, 렌더링, 인터랙티브 UI |
| `src-api.md` | `src/api/**` | CheckPackages 콜백 구조 |
| `src-io.md` | `src/io/**` | 패키지 파일 로더/라이터 규칙 |
| `src-utils.md` | `src/utils/**` | 공통 유틸 함수 작성 규칙 |
| `src-addons.md` | `src/addons/**` | 애드온 객체 작성 규칙 |

## skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `add-command.md` | 새 CLI 체크 명령 추가 절차 |
| `add-package-loader.md` | 새 패키지 포맷 로더/라이터 추가 절차 |
