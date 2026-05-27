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
        
        try {
            $request = $context.Request
            $response = $context.Response
            
            # Add CORS Headers for local development cross-origin sync
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            
            # Handle OPTIONS preflight requests
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            $urlPath = $request.Url.LocalPath
            
            # Cross-Origin Profile & State Sync API Endpoints
            if ($urlPath -eq "/api/sync") {
                if ($request.HttpMethod -eq "GET") {
                    $syncFile = Join-Path $currentDir "database_sync.json"
                    $response.ContentType = "application/json; charset=utf-8"
                    if (Test-Path $syncFile -PathType Leaf) {
                        $contentBytes = [System.IO.File]::ReadAllBytes($syncFile)
                    } else {
                        $contentBytes = [System.Text.Encoding]::UTF8.GetBytes('{"users":[],"activeUser":null}')
                    }
                    $response.ContentLength64 = $contentBytes.Length
                    $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
                }
                elseif ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $syncFile = Join-Path $currentDir "database_sync.json"
                        [System.IO.File]::WriteAllText($syncFile, $body, [System.Text.Encoding]::UTF8)
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $successBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $successBytes.Length
                        $response.OutputStream.Write($successBytes, 0, $successBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Failed to save sync file"}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
            # Logging Channel API Endpoint for Remote Browser Diagnostics
            if ($urlPath -eq "/api/log") {
                if ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $logFile = Join-Path $currentDir "browser_console.log"
                        [System.IO.File]::AppendAllText($logFile, "$body`n", [System.Text.Encoding]::UTF8)
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $successBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $successBytes.Length
                        $response.OutputStream.Write($successBytes, 0, $successBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
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
        } catch {
            Write-Host "Error processing request: $_" -ForegroundColor Red
            try { $context.Response.Close() } catch {}
        }
    }
} catch {
    Write-Host "Fatal server error: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Red
}
