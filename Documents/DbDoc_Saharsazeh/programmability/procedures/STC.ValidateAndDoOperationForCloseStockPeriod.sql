--------- Start of #7457

CREATE   PROCEDURE [STC].ValidateAndDoOperationForCloseStockPeriod
(
    @financialPeriodId INT,
    @stockId INT,
    @date DATE,
    @operation INT
)
AS
BEGIN
    --@operation  1: confirm , 2: cancelSurvey

    DECLARE @currentUser INT = CFG.GetuserID(),
            @lastConfirmDate DATE,
            @currentDate DATETIME = GETDATE(),
			@FinancialPeriodStartDate date,
			@StockLastFlowDate date,
			@PreviousYearID int,
			@IsStockClosedPreviousYear int = null

    SELECT @lastConfirmDate = MAX(scp.Date)
    FROM STC.StockClosePeriod AS scp
    WHERE scp.StockID = @stockId;

	select @FinancialPeriodStartDate = StartDate
	from cfg.FinancialPeriod
	where FinancialPeriodID = @financialPeriodId
	
	select @StockLastFlowDate = MAX(Date) from stc.VwCardex
	where StockID = @stockId
	and date<@FinancialPeriodStartDate

	select @PreviousYearID = FinancialPeriodID  from cfg.FinancialPeriod
	where EndDate = DATEADD(day,-1,@FinancialPeriodStartDate)

	if exists(
	select  1 from stc.StockClosingOperation
	where StockID = @stockId and FinancialPeriodID = @PreviousYearID)
	begin
	set @IsStockClosedPreviousYear = 1
	end

	create Table #Error
	(
	error NVARCHAR(MAX)) 


 

    IF NOT EXISTS
    (
        SELECT 1
        FROM CFG.FinancialPeriod AS fp
        WHERE fp.FinancialPeriodID = @financialPeriodId
              AND @date
              BETWEEN fp.StartDate AND fp.EndDate
    )
    BEGIN
        INSERT #Error
        SELECT 'InvalidDate';
    END;

    IF @operation = 1
    BEGIN

        IF @lastConfirmDate IS NOT NULL
           AND @date <= @lastConfirmDate
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Confirm_DateSmallerThanOfLatestConfirmDate';
        END;


		 IF @StockLastFlowDate is not null and @IsStockClosedPreviousYear is null
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Confirm_PreviousYearMustBeClosed';
        END;
	

        IF EXISTS
        (
            SELECT 1
            FROM POS.PosInvoice AS pi
                LEFT JOIN POS.DeliveryPosInvoice AS dpi
                    ON dpi.PosInvoiceID = pi.PosInvoiceID
            WHERE pi.StockID = @stockId
                  AND dpi.DeliveryPosInvoiceID IS NULL
                  AND pi.Date <= @date
                  AND PI.[Status] <> 3
        )
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Confirm_SomePosInvoicesNotDeliver';
        END;

        -- not confirms deliveries
        IF EXISTS
        (
            SELECT 1
            FROM POS.PosInvoice AS pi
                LEFT JOIN POS.DeliveryPosInvoice AS dpi
                    ON dpi.PosInvoiceID = pi.PosInvoiceID
                LEFT  JOIN POS.Delivery AS d
                    ON d.DeliveryID = dpi.DeliveryID
            WHERE pi.StockID = @stockId
			and pi.Status <> 3
                  AND (dpi.DeliveryPosInvoiceID IS NULL or d.Status <> 2)
                  AND pi.Date <= @date
        )
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Confirm_SomePosInvoicesDeliversNotConfirmed';
        END;

----Check Negative Inventory
		begin		
	Declare @TraceColumns				NVARCHAR(MAX),
			@Query						NVARCHAR(MAX),
			@SrcTable					NVARCHAR(MAX),
			@DestintationTable          NVARCHAR(MAX),
			@TraceColumnCreateTable     NVARCHAR(MAX)

	set @SrcTable = cfg.getTempTableName (1)
	set @DestintationTable = cfg.getTempTableName(1)

SELECT @TraceColumns =   STUFF(
(
	SELECT DISTINCT
		   ',' + QUOTENAME(TraceID)
	FROM STF.Trace
	where CheckInventory = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
'' );
SELECT @TraceColumnCreateTable =   STUFF(
(
	SELECT DISTINCT
		   ',' + QUOTENAME(TraceID) + '  Nvarchar(MAX)'
	FROM STF.Trace
	where CheckInventory = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
'' );



if @TraceColumns is null
set @TraceColumns = '[-1]'
if @TraceColumnCreateTable is null 
set @TraceColumnCreateTable = '[-1]  nvarchar(10)'



exec [STC].RptReviewDataSource
  @ReviewType =        1, ---1 Quantity   -----2 Amount
    @FromDate  = @FinancialPeriodStartDate,
    @ToDate = @date,
    @TableName =@SrcTable,
    @SelectedStocks = @stockId,
    @SelectedDl = NULL,
    @SelectedStuffTrace  = NULL,
    @SelectedStuffAccountGroup  = NULL,
    @SelectedStuffGroup  = NULL,
    @SelectedStuff  = NULL,
    @SelectedStockDocumentType  = NULL,
    @IsTraceTab  = 1,
    @Parameter ='Stuff',
    @StartDateFinancialPeriodID  = NULL,
	@HasGroupByDate  = 1



	set @Query = N'select  ID,Date,'+@TraceColumns+N'
	,sum(MainQuantity) over(partition by ID,'+@TraceColumns +N' order by Date) MainInLine
	into '+@DestintationTable+N'
	from '+@SrcTable



	exec (@Query)
	set @Query = N'IF exists (
	select * from '+@DestintationTable +N'
	where (MainInLine <0)
	and Date <='''+cast(@date as nvarchar(MAX))+N'''
	)
	begin 
	  INSERT  into #Error
            SELECT ''StockManager.Messages.ThereISNegativeInventory''
			end '			
exec (@Query);
	end

    END;
	
    -- cancel survey
    IF @operation = 2
    BEGIN

        IF @lastConfirmDate IS NOT NULL
           AND @date > @lastConfirmDate
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Cancel_DateBiggerThanOfLatestConfirmDate';
        END;
        IF EXISTS
        (
            SELECT 1
            FROM STC.PricingItem AS pi
            WHERE pi.LastPricingDate >= @date
                  AND pi.StockID = @stockId
        )
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Cancel_ExistPricingForSelectedStock';
        END;

        IF EXISTS
        (
            SELECT 1
            FROM STC.StockClosingOperation AS sco
            WHERE sco.StockID = @stockId
                  AND sco.FinancialPeriodID = @financialPeriodId
        )
        BEGIN
            INSERT #Error
            SELECT 'StockManager.Messages.Cancel_StockClosingOperationExistForSelectedStock';
        END;
    END;

    IF EXISTS (SELECT 1 FROM #Error AS e)
    BEGIN
        SELECT error
        FROM #Error;
        RETURN 0;
    END;
	    
    -- if there not any errors apply operation effect
    IF @operation = 2
    BEGIN
    SET @date = DATEADD(DAY,-1,@date)
    END

    IF @lastConfirmDate IS NULL
    BEGIN
		DECLARE @insTbl TABLE (
			StockClosePeriodID INT NOT NULL, 
			[Version] INT NULL
		)

        INSERT STC.StockClosePeriod
        (
            [StockID],
            [Date],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate]
        )
        VALUES
        (   @StockID,           -- StockID - int
            @Date,              -- Date - date
            1,           -- Version - int
            @currentUser,           -- Creator - int
            @currentDate,      -- CreationDate - datetime
            @currentUser,        -- LastEditor - int
            @currentDate    -- LastEditionDate - datetime
            );
    END;
    ELSE
    BEGIN
        DECLARE @StockClosePeriodID INT,
                @creator INT,
                @creationDate DATETIME,
                @version INT;

        SELECT @version = scp.Version,
               @StockClosePeriodID = scp.StockClosePeriodID,
               @creator = scp.Creator,
               @creationDate = scp.CreationDate
        FROM STC.StockClosePeriod AS scp
        WHERE scp.StockID = @stockId;
		
		UPDATE STC.StockClosePeriod
        SET [StockID] = @StockID,
            [Date] = @Date,
            [LastEditor] = @currentUser,
            [LastEditionDate] = @currentDate,
            [Version] = @Version + 1
        WHERE StockClosePeriodID = @StockClosePeriodID;

END;

	SELECT e.error FROM #Error AS e
END
