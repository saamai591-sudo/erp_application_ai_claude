CREATE   PROCEDURE [HRM].[GetValidPersonelWithBranchAccess]
(@ExecDate DATETIME=null)
AS
	DECLARE @UserId INT
	SET @UserId = cfg.GetuserID()
	
	
	SELECT T.PersonelID
	FROM   (
	           SELECT a.BranchID,
	                  a.PersonelID,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
	                  Rno
	           FROM   hrm.Agreement AS a
	           WHERE @ExecDate IS NULL OR a.ExecuteDate<=@ExecDate
	       )T
	       INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = T.BranchID
	WHERE  T.Rno = 1

	 

