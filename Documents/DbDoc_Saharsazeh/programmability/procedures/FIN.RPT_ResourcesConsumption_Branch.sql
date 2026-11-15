
---------------------------------------------------------------------
CREATE     PROC [FIN].RPT_ResourcesConsumption_Branch
(
    @FromDate DATE,
    @ToDate DATE
)
--WITH ENCRYPTION
AS
DECLARE @Culture VARCHAR(25),
        @CultureNo TINYINT,
		@UserID INT ;
		SET @UserID = CFG.GetuserID()

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;


SELECT vc.BranchID into #vwResourceConsumption
FROM fin.VWResourcesConsumption AS vc
GROUP BY vc.BranchID

SELECT v.BranchID into #vwBankAccount
FROM fin.vwbankaccount AS v
GROUP BY BranchID
SELECT * into #vwBranchAccess
FROM cfg.vwBranchAccess AS vba


SELECT B.Code,
       CASE
           WHEN @CultureNo = 1 THEN
               B.Title
           WHEN @CultureNo = 2 THEN
               B.Title2
       END AS Title,
       b.BranchID
FROM CFG.Branch B
join #vwResourceConsumption AS vrc on vrc.BranchID = B.BranchID
join #vwBankAccount AS vba on vba.BranchID = b.BranchID
join #vwBranchAccess AS vba2 on vba2.BranchID = B.BranchID;
