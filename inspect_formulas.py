import openpyxl

wb = openpyxl.load_workbook(r'c:\Users\varun\Downloads\Opti first Pos Software\Opti_Daily sales and collection Report (2).xlsx', data_only=False)
sheet = wb['Kigamboni']

print("Row 7 (Headers):", [cell.value for cell in sheet[7]])
print("Row 8 (Subheaders):", [cell.value for cell in sheet[8]])

print("\nRow 9 formulas:")
for col_idx, cell in enumerate(sheet[9], 1):
    col_letter = openpyxl.utils.get_column_letter(col_idx)
    if cell.value is not None:
        print(f"Col {col_letter} ({col_idx}): {cell.value}")
