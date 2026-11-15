Create PROCEDURE [FSS].[RemoveFinancialStatementCalculation]
    (
      @FinancialStatementID INT
    )

	AS 

		DELETE  FSS.ReportResult
	FROM  FSS.ReportResult
	INNER JOIN fss.Report
	ON Report.ReportID = ReportResult.ReportID
	WHERE FinancialStatementID=@FinancialStatementID
