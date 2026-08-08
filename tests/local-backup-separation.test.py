from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
assert "cloudLineageIncluded:false" in s, 'local progress exports must explicitly exclude cloud lineage'
# isolate local library export/import region
start=s.index('async function exportFullLibraryBackup')
end=s.index('async function updateAppShellPreserveLibrary', start)
block=s[start:end]
full_export=block[block.index('async function exportFullLibraryBackup'):block.index('async function exportProgressOnlyBackup')]
assert "addDirectoryIfPresentToZip('progress'" not in full_export, 'library export must not contain progress/'
assert "addDirectoryIfPresentToZip('forms'" in full_export and "addDirectoryIfPresentToZip('assets'" in full_export
assert 'libraryCatalogForBackup()' in full_export
assert 'progress_metadata.json' in block
assert "return p==='catalog.json' || /^(forms|assets)\\//i.test(p);" in block, 'library import must ignore progress/'
assert 'sanitizeImportedLibraryCatalog' in block
assert 'notifyLocalProgressImport' in block
assert '__STEP_LOCAL_PROGRESS_IMPORTING' in s
assert 'window.__STEP_LOCAL_PROGRESS_IMPORTING' in (root/'js/progress-sync.js').read_text()
assert 'Export Library Backup' in s and 'Import Library Backup' in s
# cloud library bridge must sanitize catalog in both directions
assert "if(norm==='catalog.json') return new Blob([JSON.stringify(libraryCatalogForBackup()" in s
assert "safe=sanitizeImportedLibraryCatalog(incoming,catalog)" in s
print('PASS local/cloud library backups exclude progress and progress-owned catalog fields')
print('PASS local progress backup excludes cloud lineage and has separate score metadata')
