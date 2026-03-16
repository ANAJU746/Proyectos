$body = @{
    tipo = "admin"
    username = "admin"
    password = "b0alo"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing

Write-Host "Status:" $response.StatusCode
Write-Host "Content:" $response.Content
