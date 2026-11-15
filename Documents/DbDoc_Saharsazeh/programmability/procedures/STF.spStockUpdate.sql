
-------------------------------------------------------
CREATE   PROC [STF].spStockUpdate 
   (@StockID int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @BranchID int,
    @Code int,
    @Supervisor nvarchar(256),
    @Phone nvarchar(50),
    @Address nvarchar(256),
    @IsStockDefault bit,
    @IsActive bit,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate DATETIME,
	@NegativeInventoryChecking bit,
	@HasZone BIT ,
    @StockTypeID int)

	--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF @Version <> ( Select [Version] from [STF].[Stock] WHERE [StockID] = @StockID )
	    RAISERROR('Version mismatch...', 16 , 10)

		DECLARE @PreNegativeInventoryChecking int 
		select @PreNegativeInventoryChecking = NegativeInventoryChecking from stf.Stock where StockID = @StockID

	IF (@NegativeInventoryChecking = 1 and @PreNegativeInventoryChecking = 0)
    BEGIN
        DECLARE @TableName1 NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @FinancialPeriodID INT,
            @Message NVARCHAR(MAX),
            @Param NVARCHAR(MAX),
            @Error BIT = 0,
			@StartDateFinancialPeriodID  int = 0,
			@ColumnForSelect nvarchar(MAX);

        SELECT @FinancialPeriodID = SettingValue
        FROM CFG.UserSetting
        WHERE SettingKey = 'DEFAULT_FININCIAL_PERIOD' AND UserID = CFG.GetuserID();

        SET @TableName1 = CFG.getTempTableName(1);

        SET @Query  = N' IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = ''' + @TableName1 + ''')DROP TABLE ' + @TableName1;
        
        EXEC (@Query);

        SELECT @Columns = STUFF(
            (
                SELECT DISTINCT
                    ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
                FROM STF.Trace
                WHERE CheckInventory = 1
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            1   ,
            ''
        );

        IF (@Columns IS NULL)
            SET @Columns = '[-1] NVARCHAR(256)';


			 SELECT @ColumnForSelect = STUFF(
            (
                SELECT DISTINCT
                    ',' + QUOTENAME(TraceID) 
                FROM STF.Trace
                WHERE CheckInventory = 1
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            1   ,
            ''
        );

        IF (@ColumnForSelect IS NULL)
            SET @ColumnForSelect = '[-1] ';

declare @Date date

 select @Date = dateadd(day,1,fp.EndDate)  from stc.StockClosingOperation sco
 join cfg.FinancialPeriod fp on sco.FinancialPeriodID = fp.FinancialPeriodID
 where sco.StockID = @StockID
 if @Date is null
 begin 
 select @Date = min(StartDate) from cfg.FinancialPeriod
 end

 	declare @LastDate Date

	select    @LastDate =   Max(Date) from 
		(
		select max(Date) Date from stc.Outgoing where StockID = @StockID 
		union all
		select max(Date) Date from stc.StockReceipt where StockID = @StockID 
		union all 
		select max(Date) Date from stc.ReturnedOutgoing where StockID = @StockID 
		union all
		select max(Date) from stc.ReturnStockReceipt where StockID = @StockID 
		union all 
		select max(pi1.Date) from pos.PosInvoice pi1 
		join pos.StationShift ss on pi1.StateShiftID = ss.StationID
		join pos.Station s on ss.StationID = s.StationID
		where s.StockID = @StockID )  a

		if @LastDate is null
		begin 
		set @LastDate = @Date
		end


					SELECT 
@StartDateFinancialPeriodID = fp.FinancialPeriodID
FROM   cfg.FinancialPeriod AS fp
WHERE  @Date BETWEEN fp.StartDate AND fp.EndDate


			exec [STC].RptReviewDataSource
			@ReviewType =        1, ---1 Quantity   -----2 Amount
			@FromDate  = @Date,
			@ToDate = @LastDate,
			@TableName =@TableName1,
			@SelectedStocks = @StockID,
			@SelectedDl = NULL,
			@SelectedStuffTrace  = NULL,
			@SelectedStuffAccountGroup  = NULL,
			@SelectedStuffGroup  = NULL,
			@SelectedStuff  = Null,
			@SelectedStockDocumentType  = NULL,
			@IsTraceTab  = 1,
			@Parameter ='Stuff',
			@StartDateFinancialPeriodID  = @StartDateFinancialPeriodID,
			@HasGroupByDate  = 1

			create table #Inventory
			(Date date,
			MainInLine decimal(36,10))

			set @Query = N'insert into #Inventory 
			select Date,sum(MainQuantity) over( partition by StockID,id,'+@ColumnForSelect+N' order by Date) MainInLine from   ' + @TableName1
			print @query
			exec (@Query)

        SET @Message = 'FirstCheckTheNegativeInventory';

        if EXISTS (select * from #Inventory
		where maininline < 0 )
		begin
		RAISERROR(@Message, 16, 12);
		end
    END;

	print 1
	UPDATE [STF].[Stock]
		SET [Title] = @Title, 
			[Title2] = @Title2, 
			[BranchID] = @BranchID, 
			[Code] = @Code, 
			[Supervisor] = @Supervisor, 
			[Phone] = @Phone, 
			[Address] = @Address, 
			[IsStockDefault] = @IsStockDefault, 
			[IsActive] = @IsActive, 
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate,
			[NegativeInventoryChecking] = @NegativeInventoryChecking,
            [HasZone] = @HasZone,
            [StockTypeID]=@StockTypeID
	WHERE  [StockID] = @StockID
	
	-- Begin Return Select <- do not remove
	SELECT [Version] 
        FROM [STF].[Stock]
	WHERE [StockID] = @StockID	
	-- End Return Select <- do not remove
