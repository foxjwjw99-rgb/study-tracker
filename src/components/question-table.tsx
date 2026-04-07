import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TableData } from "@/app/import/schema"

type QuestionTableProps = {
  tableData: string | null | undefined
}

export function QuestionTable({ tableData }: QuestionTableProps) {
  if (!tableData) return null

  let parsed: TableData
  try {
    parsed = JSON.parse(tableData) as TableData
  } catch {
    return null
  }

  if (!parsed?.headers?.length) return null

  return (
    <div className="my-3 rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            {parsed.headers.map((header, i) => (
              <TableHead key={i} className="font-semibold text-slate-700 border-r last:border-r-0 border-slate-200">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {parsed.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="border-r last:border-r-0 border-slate-200">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
