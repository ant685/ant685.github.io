$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Сервер запущен: http://localhost:8080"
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $url = $context.Request.Url.LocalPath
    if ($url -eq "/") { $url = "/index.html" }
    $file = Join-Path (Get-Location) ($url -replace "/", "\")
    if (Test-Path $file) {
        $ext = [System.IO.Path]::GetExtension($file)
        $mime = @{".html"="text/html";".css"="text/css";".js"="application/javascript";".csv"="text/csv";".json"="application/json";".png"="image/png";".jpg"="image/jpeg"}
        $context.Response.ContentType = if($mime[$ext]){$mime[$ext]}else{"application/octet-stream"}
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $context.Response.StatusCode = 404
    }
    $context.Response.Close()
}