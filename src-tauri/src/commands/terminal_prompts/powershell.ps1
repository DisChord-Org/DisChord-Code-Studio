function prompt {
    $e = [char]27;
    $s = [IO.Path]::DirectorySeparatorChar;
    $p = (Get-Location).Path;
    $r = $env:DISCHORD_WORKFLOWS;
    $h = $HOME;
    if ($r -and ($p -eq $r -or $p.StartsWith($r + $s))) {
        $label = '~WorkFlows~';
        $rest = $p.Substring($r.Length)
    } elseif ($p -eq $h -or $p.StartsWith($h + $s)) {
        $label = '~';
        $rest = $p.Substring($h.Length)
    } else {
        $label = '/';
        $rest = $p;
        if ($p -match '^[A-Za-z]:') {
            $label = $p.Substring(0, 2);
            $rest = $p.Substring(2)
        }
    };
    $parts = @($rest -split '[\\/]' | Where-Object { $_ });
    $sep = ' ' + $e + '[38;2;92;99;112m›' + $e + '[0m ';
    $out = $e + '[38;2;198;120;221m' + $label + $e + '[0m';
    for ($i = 0; $i -lt $parts.Count; $i++) {
        if ($i -gt 0 -or $label -ne '/') { $out += $sep } else { $out += ' ' };
        if ($i -eq $parts.Count - 1) {
            $out += $e + '[1;38;2;255;255;255m' + $parts[$i] + $e + '[0m'
        } else {
            $out += $e + '[38;2;86;182;194m' + $parts[$i] + $e + '[0m'
        }
    };
    if ($null -eq $global:__dc_git) { $global:__dc_git = [bool](Get-Command git -ErrorAction SilentlyContinue) };
    $branchPart = '';
    if ($global:__dc_git) {
        $b = [string](git symbolic-ref --short -q HEAD 2>$null);
        if (-not $b) { $b = [string](git rev-parse --short HEAD 2>$null) };
        if ($b) {
            if ($env:DISCHORD_ROUNDED) {
                $branchPart = $sep + $e + '[38;2;42;47;58m' + [char]0xE0B6 +
                    $e + '[38;2;137;146;245;48;2;42;47;58m' + $b.Trim() + $e + '[0m' +
                    $e + '[38;2;42;47;58m' + [char]0xE0B4 + $e + '[0m'
            } else {
                $branchPart = $sep + $e + '[38;2;137;146;245;48;2;42;47;58m' + ' ' + $b.Trim() + ' ' + $e + '[0m'
            }
        }
    };
    $e + '[38;2;92;99;112m╭─' + $e + '[0m ' +
        $e + '[1;38;2;137;146;245m' + [Environment]::UserName + $e + '[0m' +
        $sep + $out + $branchPart + [Environment]::NewLine +
        $e + '[38;2;92;99;112m╰─' + $e + '[38;2;137;146;245m>' + $e + '[0m '
}
