
CREATE   PROC VND.RptBranchReview
(
    @FinicialPeriodID INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedVendors NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedPurchaseTypes NVARCHAR(MAX) = NULL,
    @SelectedBranches NVARCHAR(MAX) = Null
)

--WITH ENCRYPTION 
AS
BEGIN

    SET ANSI_NULLS OFF;

    DECLARE @userId INT = CFG.GetuserID();
    
    DECLARE @TableName       NVARCHAR(MAX),
            @TableName1     NVARCHAR(MAX),
            @Query          NVARCHAR(MAX);
    
    set @TableName = cfg.getTempTableName(1)
    set @TableName1 = cfg.getTempTableName(1)
    


	EXEC vnd.spPurchaseReviewDataSource
		@FromDate = @FromDate,
		@ToDate = @ToDate,
		@TableName = @TableName,
		@SelectedStuff = @SelectedStuffs,
		@SelectedVendor = @SelectedVendors,
		@SelectedPurchaseType = @SelectedPurchaseTypes,
		@selectedBranch = Null

 set @query = N'

    SELECT a.BranchID,
           ISNULL(SUM(PurchasePrice), 0) AS PurchasePrice,
           ISNULL(SUM(ReturnPrice), 0) AS ReturnPrice,
           ISNULL(SUM(Discount), 0) AS PurchaseDiscount,
           ISNULL(SUM(PurchasePrice) + SUM(ReturnPrice) + SUM(Discount), 0) AS Net,
           ISNULL(SUM(Tax),0) AS Tax,
           ISNULL(SUM(Duty), 0) AS Duty
           into '+@TableName1+N'
    FROM '+@TableName+N' a
    GROUP BY a.BranchID'
    EXEC (@Query)
    
    
   EXEC (N' SELECT b.BranchID,b.Code BranchCode,b.Title BranchTitle,a.PurchasePrice,a.ReturnPrice,a.PurchaseDiscount,a.Net,a.Tax,a.Duty  FROM '+@TableName1+N' a
   join cfg.Branch b on a.BranchID = b.BranchID
   ')
    
	END
