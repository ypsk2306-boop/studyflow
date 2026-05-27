# StudyFlow Native Static File Server for Windows
# Runs natively in PowerShell without Node.js or Python

$port = 3000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Error "Could not start server. Port $port may already be in use."
    exit
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  StudyFlow local server successfully started!" -ForegroundColor Green
Write-Host "  URL: http://localhost:$port/" -ForegroundColor White
Write-Host "  Press Ctrl+C inside terminal to stop the server." -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Cyan

# Open default web browser to the server url
Start-Process "http://localhost:$port/"

$currentDir = Get-Location

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        # Route root directory to index.html
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # Replace forward slashes with backward slashes for Windows paths
        $normalizedPath = $urlPath.Replace("/", "\")
        $filePath = Join-Path $currentDir $normalizedPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $contentBytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # MIME Content-Type mapping
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            
            if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
            elseif ($ext -eq ".svg") { $contentType = "image/svg+xml; charset=utf-8" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            elseif ($ext -eq ".ico") { $contentType = "image/x-icon" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $contentBytes.Length
            $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
        } else {
            # File Not Found
            $response.StatusCode = 404
            $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $urlPath")
            $response.ContentLength64 = $errorBytes.Length
            $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
        }
        $response.Close()
    }
} catch {
    # Handles manual exit / Ctrl+C
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Red
}
