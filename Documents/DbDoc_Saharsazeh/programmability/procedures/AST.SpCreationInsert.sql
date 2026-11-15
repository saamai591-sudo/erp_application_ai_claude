CREATE PROC [AST].SpCreationInsert
    @BranchID INT,
    @Date DATE,
    @Number INT,
    @CreationType TINYINT,
    @PurchaseInvoiceItemID INT = NULL,
    @OutgoingItemID INT = NULL,
    @DestructionItemID INT = NULL,
    @BaseValue DECIMAL(30, 4),
    @AccumulatedDepreciation DECIMAL(30, 4),
    @Quantity SMALLINT,
    @FinancialPeriodID INT,
    @Creator INT,
    @CreationDate DATETIME,
    @TransferItemID INT = NULL,
    @StuffID INT = NULL,
    @AssetTitle NVARCHAR(500),
    @AssetTitle2 NVARCHAR(500),
    @AccountingDate DATE,
    @AssetType TINYINT,
    @AssetCategoryID INT,
    @SalvageValue DECIMAL(30, 4),
    @UsageDate DATE,
    @DuringDepreciation DECIMAL(36, 10)
--WITH ENCRYPTION 
AS
    SET NOCOUNT ON;
	declare @StartDate Date
	select @StartDate = StartDate
	from cfg.FinancialPeriod
	where FinancialPeriodID = @FinancialPeriodID

    IF (@OutgoingItemID IS NOT NULL)
    BEGIN
        IF EXISTS
        (
            SELECT *
            FROM AST.Creation
            WHERE OutgoingItemID = @OutgoingItemID
        )
        BEGIN

            RAISERROR(' حواله انبار انتخاب شده قبلا ایجاد دارایی شده است.', 16, 12);
            RETURN;
        END;
        IF EXISTS
        (
            SELECT *
            FROM AST.RepairStuffCost
            WHERE OutgoingItemID = @OutgoingItemID
        )
        BEGIN

            RAISERROR('برای حواله انبار انتخاب شده قبلا تعمیر دارایی صادر شده است.', 16, 12);
            RETURN;
        END;
    END;

    IF (@DestructionItemID IS NOT NULL)
    BEGIN
        IF EXISTS
        (
            SELECT *
            FROM AST.Creation
            WHERE DestructionItemID = @DestructionItemID
        )
        BEGIN

            RAISERROR('دارایی خارج شده انتخاب شده قبلا ایجاد دارایی شده است.', 16, 12);
            RETURN;
        END;

		declare @DestructedAssetID int,
				@DestrucionDate Date

		select  @DestructedAssetID = AssetID,
				@DestrucionDate = d.Date
		from ast.DestructionItem di
		join ast.Destruction d on d.DestructionID = di.DestructionID
		where DestructionItemID = @DestructionItemID

		if  @DestrucionDate <> @StartDate and  @DestructedAssetID not in (select assetid from ast.Depreciation where Date = @DestrucionDate)
		begin

				select d.AssetID,sum(d.Value) Depreciation 
				into #Depreciation
				from ast.Depreciation d	
				where assetid = @DestructedAssetID
				group by d.AssetID


				select assetid,sum(value) value
				into #AssetValue
				from [AST].[VWAssetValue]
				where assetid = @DestructedAssetID
				group by assetid

				IF EXISTS
				(
					select 1
					from ast.Asset ass 
					join ast.AssetCategory ac on ac.AssetCategoryID = ass.AssetCategoryID
					left join #Depreciation aa on ass.AssetID = aa.AssetID
					join #AssetValue v on v.assetid = ass.AssetID
					where ass.AssetID =  @DestructedAssetID
					and ac.DepreciationMethod <> 3
					and (v.value - ass.AccumulatedDepreciation - ass.DuringDepreciation - ass.SalvageValue - isnull(aa.Depreciation,0)) > 0
				)
				BEGIN

					RAISERROR('ابتدا برای دارایی احیاشده محاسبه استهلاک داراییهای خارج شده را انجام دهید.', 16, 12);
					RETURN;
				END;

		end

    END;

    IF (@TransferItemID IS NOT NULL)
    BEGIN
        IF EXISTS
        (
            SELECT *
            FROM AST.Creation
            WHERE TransferItemID = @TransferItemID
        )
        BEGIN

            RAISERROR('پلاک انتقالی انتخاب شده قبلا ایجاد دارایی شده است.', 16, 12);
            RETURN;
        END;

		declare @TransferedAssetID int,
				@TransferedDate Date

		select  @TransferedAssetID = AssetID,
				@TransferedDate = d.Date
		from ast.TransferItem di
		join ast.Transfer d on d.TransferID = di.TransferID
		where TransferItemID = @TransferItemID

		if  @TransferedDate <> @StartDate and  @TransferedAssetID not in (select assetid from ast.Depreciation where Date = @TransferedDate)
		begin

				select d.AssetID,sum(d.Value) Depreciation 
				into #Depreciation1
				from ast.Depreciation d	
				where assetid = @TransferedAssetID
				group by d.AssetID


				select assetid,sum(value) value
				into #AssetValue1
				from [AST].[VWAssetValue]
				where assetid = @TransferedAssetID
				group by assetid

				--IF EXISTS
				--(
				--	select 1
				--	from ast.Asset ass 
				--	join ast.AssetCategory ac on ac.AssetCategoryID = ass.AssetCategoryID
				--	left join #Depreciation1 aa on ass.AssetID = aa.AssetID
				--	join #AssetValue1 v on v.assetid = ass.AssetID
				--	where ass.AssetID =  @TransferedAssetID
				--	and ac.DepreciationMethod <> 3
				--	and (v.value - ass.AccumulatedDepreciation - ass.DuringDepreciation - ass.SalvageValue - isnull(aa.Depreciation,0)) > 0
				--)
				--BEGIN

				--	RAISERROR('ابتدا برای دارایی منتقل شده محاسبه استهلاک داراییهای منتقل شده را انجام دهید.', 16, 12);
				--	RETURN;
				--END;

		end

    END;


    INSERT INTO [AST].[Creation]
    (
        [BranchID],
        [Date],
        [Number],
        [CreationType],
        [PurchaseInvoiceItemID],
        [OutgoingItemID],
        [BaseValue],
        [AccumulatedDepreciation],
        [Quantity],
        [FinancialPeriodID],
        [PreVoucherID],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [DestructionItemID],
        [TransferItemID],
        StuffID,
        AssetTitle,
        AssetTitle2,
        AccountingDate,
        AssetType,
        AssetCategoryID,
        SalvageValue,
        UsageDate,
        DuringDepreciation
    )
    SELECT @BranchID,
           @Date,
           0,
           @CreationType,
           @PurchaseInvoiceItemID,
           @OutgoingItemID,
           @BaseValue,
           @AccumulatedDepreciation,
           @Quantity,
           @FinancialPeriodID,
           NULL,
           0,
           @Creator,
           @CreationDate,
           @Creator,
           @CreationDate,
           @DestructionItemID,
           @TransferItemID,
           @StuffID,
           @AssetTitle,
           @AssetTitle2,
           @AccountingDate,
           @AssetType,
           @AssetCategoryID,
           @SalvageValue,
           @UsageDate,
           @DuringDepreciation;

           declare @CreationId int = SCOPE_IDENTITY(),
                @engName  NVARCHAR(255) = 'Creation',
                @NumberingPattern INT

           --TODO : Do Numbering
            EXEC cfg.spGetPatternLastNumber
			            @EntityName = @engName,
			            @SaleAreaID = NULL,
			            @StationID = NULL,
			            @FinancialPeriodID = @FinancialPeriodID,
			            @SaleTypeID = NUll,
			            @BranchID = @BranchID,
                        @Date = @Date,
			            @number = @Number OUTPUT,
	                    @NumberingPattern = @NumberingPattern  OUTPUT

            UPDATE  [AST].[Creation]
            SET Number =@Number
            WHERE CreationID = @CreationId
                                    
			UPDATE cfg.NumberingPattern
			SET LastAssignedNumber = @Number
			WHERE NumberingPatternID = @NumberingPattern

    -- Begin Return Select <- do not remove
    SELECT [CreationID],
           [Version],
           Number
    FROM [AST].[Creation]
    WHERE [CreationID] = @CreationId;
    -- End Return Select <- do not remove

    IF (@CreationType = 2)
    BEGIN

        DECLARE @Num INT = NULL;

        SELECT @Num = p.Number
        FROM VND.PurchaseInvoiceItem i
            JOIN VND.PurchaseInvoice p
                ON p.PurchaseInvoiceID = i.PurchaseInvoiceID
            JOIN VND.PurchaseInvoice_PriceRemains pr
                ON i.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
        WHERE i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID
              AND pr.Non < 0;

        IF (@Num IS NOT NULL)
        BEGIN
            RAISERROR('مانده مستهلک نشده فاکتور خرید شماره (%d) منفی خواهد شد.', 16, 12, @Num);
            RETURN;
        END;

    END;