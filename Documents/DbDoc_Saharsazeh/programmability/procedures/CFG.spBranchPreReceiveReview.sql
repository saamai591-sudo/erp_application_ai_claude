CREATE   PROC [CFG].[spBranchPreReceiveReview]
	(	@FromDate DATE,
		@ToDate DATE,
		@SelectedParties NVARCHAR(MAX),
		@SelectedDocuments NVARCHAR(MAX))
AS 
BEGIN
	DECLARE @TableName      NVARCHAR(MAX),
	        @TableName1     NVARCHAR(MAX),
	        @Query          NVARCHAR(MAX);
	
	SET @TableName = CFG.getTempTableName(1)
	SET @TableName1 = CFG.getTempTableName(1)
	
	EXEC cfg.spPreReceiveDataSource
	     @TableName = @TableName,
	     @FromDate = @FromDate,
	     @ToDate = @ToDate,
	     @SelectedBranchs=null,
		@SelectedParties =@SelectedParties,
		@SelectedDocuments =@SelectedDocuments
	
	SET @Query = 
	    N'select
	 a.BranchID,
	 a.CurrencyID,
	 sum(PreReciveAmount) PreReciveAmount,
	 sum(DepreciatedAmount) DepreciatedAmount
	 into ' + @TableName1 + N'
	 from ' + @TableName + N' a
	             group by a.BranchID,a.CurrencyID'
	
	EXEC (@Query)
	
	SET @Query = 
	    N'Select b.BranchID,b.Title,b.Title2,c.Title CurrencyTitle,C.Title2 CurrencyTitle2,a.PreReciveAmount,a.DepreciatedAmount,a.PreReciveAmount-a.DepreciatedAmount
as NonDepreciated
from ' + @TableName1 + 
	    N' a
join cfg.Branch B on a.BranchID=b.BranchID
join Cfg.Currency c on a.CurrencyID=c.CurrencyID'
	
	EXEC (@Query)
END