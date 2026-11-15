
CREATE    PROC VND.RptPurchaseTypeReview
(
    @FinicialPeriodID INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedVendors NVARCHAR(MAX) = NULL,
    @SelectedBranchs NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL
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
    
    

 DECLARE @Culture VARCHAR(25),
         @CultureNo TINYINT;

 SET @Culture = CFG.GetuserCulture();

 SELECT @CultureNo = CultureNo
 FROM CFG.CultureInfo
 WHERE Culture = @Culture;
    


	EXEC vnd.spPurchaseReviewDataSource
		@FromDate = @FromDate,
		@ToDate = @ToDate,
		@TableName = @TableName,
		@SelectedStuff = @SelectedStuffs,
		@SelectedVendor = @SelectedVendors,
		@SelectedPurchaseType = Null,
		@selectedBranch = @SelectedBranchs
		
		
		
 set @query = N'

    SELECT a.PurchaseTypeID,
           ISNULL(SUM(PurchasePrice), 0) AS PurchasePrice,
           ISNULL(SUM(ReturnPrice), 0) AS ReturnPrice,
           ISNULL(SUM(Discount), 0) AS PurchaseDiscount,
          isnull(SUM(PurchasePrice),0) + isnull(SUM(ReturnPrice),0) + isnull(SUM(Discount),0) AS NetPurchase,
           ISNULL(SUM(Tax),0) AS Tax,
           ISNULL(SUM(Duty), 0) AS Duty,
           Isnull(sum(Net),0) Net
           into '+@TableName1+N'
    FROM '+@TableName+N' a
    GROUP BY a.PurchaseTypeID'
    EXEC (@Query)
    
    
 set @Query = N' SELECT b.PurchaseTypeID,b.Code , CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS Title,a.PurchasePrice,a.ReturnPrice,a.PurchaseDiscount Discount,a.Net NetPrice,a.Tax,a.Duty,
           a.Net
             FROM '+@TableName1+N' a
   join vnd.PurchaseType b on a.PurchaseTypeID = b.PurchaseTypeID'
    
   
   EXECUTE sp_Executesql @Query,
						N'@CultureNo TinyInt',
     @CultureNo = @CultureNo
     
END
