# 查看 PaddleOCRSharp.dll 中的 API
$dllPath = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\lib\net6.0\PaddleOCRSharp.dll"

if (-not (Test-Path $dllPath)) {
    Write-Host "DLL 未找到: $dllPath" -ForegroundColor Red
    exit 1
}

# 加载程序集
$assembly = [System.Reflection.Assembly]::LoadFrom($dllPath)

# 查找 PaddleOCREngine 类型
$engineType = $assembly.GetTypes() | Where-Object { $_.Name -eq "PaddleOCREngine" }

if (-not $engineType) {
    Write-Host "PaddleOCREngine 类型未找到" -ForegroundColor Red
    exit 1
}

Write-Host "=== PaddleOCREngine 构造函数 ===" -ForegroundColor Green
$engineType.GetConstructors() | ForEach-Object {
    $params = ($_.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
    Write-Host "PaddleOCREngine($params)"
}

Write-Host "`n=== PaddleOCREngine 公共方法 ===" -ForegroundColor Green
$engineType.GetMethods([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::DeclaredOnly) | ForEach-Object {
    $params = ($_.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
    Write-Host "$($_.ReturnType.Name) $($_.Name)($params)"
}

Write-Host "`n=== OCRResult 类型 ===" -ForegroundColor Green
$resultType = $assembly.GetTypes() | Where-Object { $_.Name -eq "OCRResult" }
if ($resultType) {
    $resultType.GetProperties() | ForEach-Object {
        Write-Host "$($_.PropertyType.Name) $($_.Name)"
    }
}
