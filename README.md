# BarLoop

YouTube, 로컬 영상 또는 음원을 마디·시간 구간으로 반복하고 드럼 연습에 필요한 클릭과 템포 훈련을 브라우저에서 실행하는 React 도구입니다. 서버, 계정, 서버 DB를 사용하지 않습니다.

## 영상·음원 연습

- YouTube, 로컬 영상, 로컬 음원 재생
- BPM·박자·첫 다운비트 기준 마디 자동 분할
- 마디 범위 및 A–B 시간 반복
- 음원 파형과 터치 가능한 A/B 반복 핸들
- 원곡 음량과 메트로놈 음량 독립 조절
- A 지점 1박·1마디·2마디 전부터 듣는 프리롤
- 3마디 Groove + 1마디 Fill, 7마디 Groove + 1마디 Fill 빠른 설정
- Web Audio 기반 메트로놈과 첫 박 강세
- 4분·8분·셋잇단·16분 서브디비전
- 0·1·2·4마디 카운트인과 Gap Click
- 반복 횟수 기준 템포 트레이너
- BPM 입력 선행 0 자동 제거 (`088` → `88`)
- 반복 구간 프리셋, 메모, 목표 횟수
- 전체 화면 드러머 연습 모드와 화면 꺼짐 방지
- 선택적 Web MIDI 패드 조작

## 독립 메트로놈 페이지

메인 화면 왼쪽 아래의 **메트로놈 전용 연습** 버튼 또는 `#metronome` 경로로 이동합니다. 영상이나 음원을 불러오지 않아도 사용할 수 있습니다.

- AudioContext 시계 기반 선행 예약 스케줄러
- 20~400 BPM, Tap Tempo, 자주 쓰는 BPM 프리셋
- 2~12박자와 박별 사용자 악센트
- 4분·8분·셋잇단·16분음표
- Straight, Light Swing, Triplet Swing, Heavy Swing
- Classic, Wood, Rim, Cowbell 클릭 음색
- 기본 클릭·강세·서브디비전 개별 음량
- Gap Click의 클릭 마디·무음 마디 설정
- 마디 수 기준 자동 BPM 증가
- Single Stroke, Double Stroke, Paradiddle 등 러디먼트 표시
- 5·10·15·20·30분 연습 타이머
- Space 시작·정지, `+`·`-` BPM 조절
- 휴대폰·태블릿 세로·가로 화면 대응

## 연습 코치와 기록

- 목표 시간과 연주·휴식 인터벌
- 완료·중단 세션 저장
- 세션 이름, 시작 BPM, 최고 BPM, 메모
- 최근 7일 세션 수·총 연습 시간·완료 수·최고 BPM
- 세션 기록을 `localStorage`와 브라우저 `IndexedDB`에 함께 보관
- 전체 설정·구간·기록 JSON 백업 및 복원

## 오프라인과 업데이트

- 설치형 웹앱(PWA) 지원
- 로컬 영상·음원, 메트로놈, 저장된 설정의 오프라인 사용
- 새 서비스 워커가 준비되면 **새 버전 있음** 표시
- 사용자가 선택하면 새 버전으로 즉시 전환
- YouTube 재생은 인터넷 연결 필요

## 개인정보와 저장 방식

로컬 미디어 파일은 `URL.createObjectURL()`로 현재 브라우저에서만 읽으며 서버로 전송하지 않습니다. 설정과 구간은 `localStorage`, 누적 연습 기록은 `localStorage`와 `IndexedDB`에 저장합니다. 다른 기기로 옮길 때는 전체 JSON 백업·복원을 사용합니다. 미디어 원본은 백업 파일에 포함되지 않습니다.

## 실행과 테스트

```bash
npm install
npm run dev
```

테스트와 프로덕션 빌드:

```bash
npm test
npm run build
npm run preview
```

BPM 입력 정규화는 Vitest 회귀 테스트로 검증하며, GitHub Pages 워크플로에서도 빌드 전에 테스트를 실행합니다.

## 모바일·태블릿

- iPhone/iPad Safari와 Android Chromium 계열에서 터치 조작을 기본으로 설계했습니다.
- Fullscreen API가 없는 브라우저에서도 인앱 전체 화면 연습 모드를 사용합니다.
- 화면 꺼짐 방지와 Web MIDI는 지원 브라우저에서만 활성화됩니다.
- YouTube와 로컬 파일의 재생 정책상 처음에는 사용자의 화면 터치가 필요할 수 있습니다.

## 키보드 단축키

### 영상·음원 연습

| 키 | 기능 |
|---|---|
| `Space` | 재생 / 일시정지 |
| `←` / `→` | 5초 이전 / 다음 |
| `Shift` + `←` / `→` | 0.1초 이전 / 다음 |
| `R` | 반복 구간 처음으로 이동 |
| `L` | 반복 ON / OFF |
| `[` / `]` | 현재 위치를 A / B로 설정 |

### 독립 메트로놈

| 키 | 기능 |
|---|---|
| `Space` | 메트로놈 시작 / 정지 |
| `+` / `=` | BPM +1 |
| `-` | BPM -1 |

## 권장 미디어 형식

- 영상: MP4(H.264/AAC), WebM
- 음원: MP3, WAV, M4A/AAC, OGG

MOV, HEVC/H.265, FLAC 등은 운영체제와 브라우저에 따라 재생되지 않을 수 있습니다.

## 배포

`.github/workflows/deploy-pages.yml`이 다음 순서로 검증합니다.

1. 의존성 설치
2. Vitest 회귀 테스트
3. TypeScript·Vite 프로덕션 빌드
4. Pages 아티팩트 생성
5. `main` 병합 후 공개 HTML·JavaScript 스모크 테스트
