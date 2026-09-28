Add-Type -AssemblyName System.windows.forms

$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Select AmiBroker Installation Folder"
$f.ShowNewFolderButton = $false

# Create a dummy form to force the dialog to the front
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.BringToFront()

$result = $f.ShowDialog($form)

if ($result -eq 'OK') {
    Write-Output $f.SelectedPath
}

$form.Dispose()
