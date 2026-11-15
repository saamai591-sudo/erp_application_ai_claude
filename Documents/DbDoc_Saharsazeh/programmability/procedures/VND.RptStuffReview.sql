
create    PROC VND.RptStuffReview
(
    @FinicialPeriodID INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedBranchs NVARCHAR(MAX) = NULL,
    @SelectedVendors NVARCHAR(MAX) = NULL,
    @SelectedPurchaseTypes NVARCHAR(MAX) = NULL
)

--WITH ENCRYPTION 
AS
BEGIN
    SET ANSI_NULLS OFF;


    DECLARE @Service NVARCHAR(100),
            @Stuff NVARCHAR(100),
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @Service = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'MeasureUnitTypes'
          AND le.Item = 'Service'
          AND lev.Culture = @Culture;

    SELECT @Stuff = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'MeasureUnitTypes'
          AND le.Item = 'Stuff'
          AND lev.Culture = @Culture;


    DECLARE @userId INT;
    SET @userId = CFG.GetuserID();
    
    DECLARE @TableName       NVARCHAR(MAX),
            @TableName1     NVARCHAR(MAX),
            @Query          NVARCHAR(MAX);
    
    
    set @TableName = cfg.getTempTableName(1)
    set @TableName1 = cfg.getTempTableName(1)


	EXEC vnd.spPurchaseReviewDataSource
		@FromDate = @FromDate,
		@ToDate = @ToDate,
		@TableName = @TableName,
		@SelectedStuff = Null,
		@SelectedVendor = @SelectedVendors,
		@SelectedPurchaseType = @SelectedPurchaseTypes,
		@selectedBranch = @SelectedBranchs
		
		
		SELECT * into #vwStuff
		FROM stf.VWStuff AS v
		
 set @query = N'

    SELECT a.StuffID,
           SUM(MainQuantity)                 PurchaseMainQuantity,
           SUM(SubQuantity)               AS PurchaseSubQuantity,
           ISNULL(SUM(PurchasePrice), 0)  AS PurchasePrice,
           ISNULL(SUM(ReturnPrice), 0)    AS ReturnPrice,
           ISNULL(SUM(Discount), 0)       AS Discount,
           ISNULL(SUM(PurchasePrice), 0) + ISNULL(SUM(ReturnPrice), 0) + ISNULL(SUM(Discount), 0) AS NetPurchase,
           ISNULL(SUM(Tax), 0)            AS Tax,
           ISNULL(SUM(Duty), 0)           AS Duty,
           ISNULL(SUM(Net), 0)               Net
    INTO   '+@TableName1+N'
    FROM   '+@TableName+N'                   a
    GROUP BY
           a.StuffID'
    EXEC (@Query)
    
 print 444
		

     
     set @Query = N'
		
			SELECT s.StuffID,
				   s.Code AS StuffCode,
				   CASE
					   WHEN @CultureNo = 1 THEN
						   s.Title
					   WHEN @CultureNo = 2 THEN
						   s.Title2
				   END AS StuffTitle,
				   S.TechnicalCode,
				   CASE
					   WHEN s.Type = 0 THEN
						   @Stuff
					   ELSE
						   @Service
				   END AS Type,
				   CASE
					   WHEN @CultureNo = 1 THEN
						   S.MainMeasureUnit
					   ELSE
						   S.MainMeasureUnit2
				   END AS MainMeasureUnit,
				   CASE
					   WHEN @CultureNo = 1 THEN
						   s.SubMeasureUnit
					   ELSE
						   s.SubMeasureUnit2
				   END AS SubMeasureUnit,
				   PurchaseMainQuantity AS MainQuantity,
				   PurchaseSubQuantity AS SubQuantity,
				   PurchasePrice AS PurchasePrice,
				   ReturnPrice AS ReturnPrice,
				   a.Discount PurchaseDiscount,
				   PurchasePrice + ReturnPrice +Discount AS Net,
				   a.Tax,
				   a.Duty
			FROM #vwStuff s
				JOIN '+@TableName1+N' a 
				
					ON A.StuffID = s.StuffID'
					

   
   EXECUTE sp_Executesql @Query,
						N'@CultureNo TinyInt,
						  @Service Nvarchar(100),
						  @Stuff  Nvarchar(100)',
     @CultureNo = @CultureNo,
     @Service = @Service,
     @Stuff = @Stuff					
					


END;
