
/****** Object:  StoredProcedure [PAY].[PersonelLoanDebit]    Script Date: 4/30/2019 12:14:59 PM ******/

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 3/18/2019 11:44:12 AM
 ************************************************************/

CREATE PROCEDURE [PAY].[PersonelLoanDebit](@Date DATE)
AS

	CREATE TABLE #P(
		PersonelId INT,
		PartyId INT,
		Code VARCHAR(128),
		FullName NVARCHAR(1024)	
	)

	DECLARE @Todate DATE
	SET @Todate=GETDATE()

	INSERT INTO #P
	exec HRM.GetActivePersonelSimpleList  @Todate,0

	
	SELECT CAST([PAY].[vwPersonelLoanDebit].ItemType * 100000000 + Id AS  bigint) AS DocumentId,
	  [PAY].[vwPersonelLoanDebit].*,
	  FullName AS PersonelName,
	  Code AS PersonelCode
	FROM   [PAY].[vwPersonelLoanDebit]
	INNER JOIN #P
	ON #P.PersonelId = [PAY].[vwPersonelLoanDebit].PersonelId
	WHERE  RemainValue > 0
	       AND [Date] <= @Date


