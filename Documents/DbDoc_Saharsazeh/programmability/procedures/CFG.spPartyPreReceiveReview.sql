/************************************************************
 * Code formatted by SoftTree SQL Assistant © v11.3.277
 * Time: 5/15/2021 3:05:44 PM
 ************************************************************/

CREATE   PROC [CFG].[spPartyPreReceiveReview]
	(	@FromDate DATE,
		@ToDate DATE,
		@SelectedBranchs NVARCHAR(MAX),
		@SelectedDocuments NVARCHAR(MAX))
AS 
BEGIN
	DECLARE @TableName      NVARCHAR(MAX),
	        @TableName1     NVARCHAR(MAX),
	        @Query          NVARCHAR(MAX),
	        @Culture        VARCHAR(5),
	        @CultureNo      TINYINT ;
	
	SET @TableName = CFG.getTempTableName(1)
	SET @TableName1 = CFG.getTempTableName(1)
	
	SET @Culture = CFG.GetuserCulture()
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	EXEC cfg.spPreReceiveDataSource
	     @TableName = @TableName,
	     @FromDate = @FromDate,
	     @ToDate = @ToDate,
	     @SelectedBranchs=@SelectedBranchs,
	     @SelectedParties=NULL,
	     @SelectedDocuments=@SelectedDocuments

	
	SET @Query = 
	    N'select
	 a.PartyID,
	 a.CurrencyID,
	 sum(PreReciveAmount) PreReciveAmount,
	 sum(DepreciatedAmount) DepreciatedAmount
	 into ' + @TableName1 + N'
	 from ' + @TableName + N' a
	             group by a.PartyID,a.CurrencyID'
	
	EXEC (@Query)
	PRINT 'a5'
	
	SET @Query = 
	    N'Select d.DlID, 
	    (case when @CultureNo=1 then  D.Title else d.Title2 end) DlTitle,
	    (case when @CultureNo=1 then c.Title else c.Title2 end) CurrencyTitle,
	    a.PreReciveAmount,
	    a.DepreciatedAmount,
	    a.PreReciveAmount-a.DepreciatedAmount as NonDepreciated
from ' + @TableName1 + 
	    N' a
join cfg.party p on a.PartyID=p.PartyID
join acc.Dl d on p.DlID=d.DlID
join Cfg.Currency c on a.CurrencyID=c.CurrencyID'
	PRINT @Query
EXEC sp_executesql @Query,
N'@CultureNo Tinyint',
@CultureNo=@CultureNo
END