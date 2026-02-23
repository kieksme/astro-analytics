# Astro Analytics — Tiện ích mở rộng VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Ngôn ngữ:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Chưa biết Astro? Xem [astro.build](https://astro.build).

**Nhà phát hành:** kieks.me GbR

Hiển thị số liệu Google Analytics GA4 trực tiếp trong VS Code khi bạn mở file Astro Markdown hoặc `.astro`.

## Tính năng

- **CodeLens** ở đầu mỗi file `.md`/`.mdx`/`.astro` với Tỷ lệ thoát, Lượt xem, Người dùng và Thời lượng phiên
- **Explorer** — Tỷ lệ thoát hiển thị cạnh tên file trong cây thư mục khi có dữ liệu analytics (huy hiệu + tooltip)
- **Tooltip khi di chuột** với bảng số liệu đầy đủ (di chuột lên vài dòng đầu file)
- **Thanh trạng thái** ở góc dưới bên phải với Tỷ lệ thoát của trang đang mở
- Bộ nhớ đệm tự động (TTL 5 phút), làm mới thủ công khi bấm

## Mã màu Tỷ lệ thoát

Tiện ích hiển thị tỷ lệ thoát bằng chỉ báo màu (xanh lá / vàng / cam / đỏ) trong CodeLens, explorer, tooltip, thanh trạng thái và bảng điều khiển:

| Mức | Tỷ lệ thoát |
|-----|-------------|
| 🟢 | < 25% — Rất tốt |
| 🟡 | 25–44% — Tốt |
| 🟠 | 45–64% — Trung bình |
| 🔴 | ≥ 65% — Cần cải thiện |

## Thiết lập

### 1. Chuẩn bị thông tin xác thực

Tiện ích cần Google Application Default Credentials với phạm vi `analytics.readonly`.

Nếu chưa có, hãy tạo ADC. Xem hướng dẫn video, ví dụ [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Đường dẫn tới file thông tin xác thực được in ra console:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Cấu hình tiện ích

Trong VS Code: `Cmd+,` → tìm **Astro Analytics**

| Cài đặt | Mô tả | Mặc định |
|---------|-------|----------|
| `astroAnalytics.propertyId` | ID Thuộc tính GA4 (số) | `364493652` |
| `astroAnalytics.credentialsPath` | Đường dẫn tới file JSON thông tin xác thực | (mặc định ADC) |
| `astroAnalytics.lookbackDays` | Số ngày truy vấn | `30` |
| `astroAnalytics.contentRoot` | Thư mục nội dung Astro | `src/content` |
| `astroAnalytics.pagesRoot` | Thư mục trang Astro | `src/pages` |

Ví dụ `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Ánh xạ slug URL

Tiện ích suy ra `pagePath` GA4 từ đường dẫn file:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Tuyến động** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) được hỗ trợ:

- Trong **bảng điều khiển**, đường dẫn GA4 như `/blog/` có thể được giải thành file tuyến động (vd. `src/pages/[slug].astro`) khi không có file tĩnh.
- Khi **mở file tuyến động**, tiện ích hiển thị tỷ lệ thoát, lượt xem, người dùng và thời lượng phiên **tổng hợp** cho mọi đường dẫn GA4 khớp với tuyến đó.

### 4. Kiểm tra dữ liệu có tải không

Nếu không thấy số liệu (CodeLens hiển thị "no data" hoặc thanh trạng thái trống):

1. **Chạy lệnh kiểm tra** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. Có thể dùng **"Astro Analytics: Open Dashboard"**.
2. **Kiểm tra cấu hình** — Đảm bảo `astroAnalytics.propertyId` đã đặt và nếu cần `astroAnalytics.credentialsPath` trỏ tới file JSON thông tin xác thực.
3. **Kiểm tra khớp slug** — `pagePath` GA4 và slug của tiện ích đều dùng dấu gạch chéo cuối (vd. `/blog/my-post/`). Tiện ích chuẩn hóa đường dẫn cho tra cứu nếu cần.
4. **Xem kênh Output** — Lỗi API hiển thị ở đó và dưới dạng thông báo.

**Nếu không tìm thấy lệnh "Astro Analytics: Test API Connection":** Build lại tiện ích và tải lại cửa sổ. Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Bản địa hóa

Tiện ích được bản địa hóa cho các ngôn ngữ sau. Giao diện theo ngôn ngữ hiển thị của VS Code khi có bản dịch:

| Ngôn ngữ | Locale |
|----------|--------|
| English | `en` |
| Deutsch | `de` |
| Français | `fr` |
| Español | `es` |
| Italiano | `it` |
| Português | `pt` |
| Nederlands | `nl` |
| Polski | `pl` |
| Русский | `ru` |
| 简体中文 | `zh-cn` |
| 日本語 | `ja` |
| हिन्दी | `hi` |
| 한국어 | `ko` |
| Indonesia | `id` |
| Tiếng Việt | `vi` |
| ไทย | `th` |
| বাংলা | `bn` |

Bản dịch nằm trong `package.nls.*.json` (UI) và `l10n/bundle.l10n.*.json` (thông báo và bảng điều khiển).

## Cài đặt

Cài từ [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) hoặc từ file `.vsix` (`Cmd+Shift+P` → **"Install from VSIX..."**). Để build từ nguồn, xem [CONTRIBUTING.md](CONTRIBUTING.md).
