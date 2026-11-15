CREATE PROC [AST].[SpCreationUpdate]
    @CreationID INT,
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
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
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

    IF @Version <>
    (
        SELECT [Version] FROM [AST].[Creation] WHERE [CreationID] = @CreationID
    )
        RAISERROR('Version mismatch...', 16, 10);

    IF @Quantity > 1
       AND @BaseValue > 0
       AND @BaseValue < @Quantity
    BEGIN

        RAISERROR('بهای پایه هر پلاک نمی تواند کوچکتر از یک باشد.', 16, 12);
        RETURN;
    END;

    DECLARE @PreCreationType TINYINT,
            @PreDestructionItemID INT = NULL,
            @PreAssetID INT = NULL,
            @PreQuantity SMALLINT,
            @PreOutgoingItemID INT = NULL,
			@FinancialPeriodID int;

    SELECT @PreCreationType = c.CreationType,
           @PreDestructionItemID = c.DestructionItemID,
           @PreOutgoingItemID = c.OutgoingItemID,
           @PreQuantity = c.Quantity,
		   @FinancialPeriodID = FinancialPeriodID
    FROM AST.Creation c
    WHERE c.CreationID = @CreationID;

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
                  AND CreationID <> @CreationID
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
            SELECT 1
            FROM AST.Creation
            WHERE DestructionItemID = @DestructionItemID
                  AND CreationID <> @CreationID
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
;
    END;

    IF (@TransferItemID IS NOT NULL)
    BEGIN
        IF EXISTS
        (
            SELECT *
            FROM AST.Creation
            WHERE TransferItemID = @TransferItemID
                  AND CreationID <> @CreationID
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

				IF EXISTS
				(
					select 1
					from ast.Asset ass 
					join ast.AssetCategory ac on ac.AssetCategoryID = ass.AssetCategoryID
					left join #Depreciation1 aa on ass.AssetID = aa.AssetID
					join #AssetValue1 v on v.assetid = ass.AssetID
					where ass.AssetID =  @TransferedAssetID
					and ac.DepreciationMethod <> 3
					and (v.value - ass.AccumulatedDepreciation - ass.DuringDepreciation - ass.SalvageValue - isnull(aa.Depreciation,0)) > 0
				)
				BEGIN
					RAISERROR('ابتدا برای دارایی منتقل شده محاسبه استهلاک داراییهای منتقل شده را انجام دهید.', 16, 12);
					RETURN;
				END;
		end
    END;

    IF (@Number IS NULL OR @Number = 0)
        SET @Number = ISNULL(
                      (
                          SELECT MAX(c.Number)
                          FROM AST.Creation c
                          WHERE c.FinancialPeriodID = @FinancialPeriodID
                      ),
                      0
                            ) + 1;

    SET @Version = @Version + 1;

    UPDATE [AST].[Creation]
    SET [BranchID] = @BranchID,
        [Date] = @Date,
        [Number] = @Number,
        [CreationType] = @CreationType,
        [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID,
        [OutgoingItemID] = @OutgoingItemID,
        [DestructionItemID] = @DestructionItemID,
        [BaseValue] = @BaseValue,
        [AccumulatedDepreciation] = @AccumulatedDepreciation,
        [Quantity] = @Quantity,
        [Version] = @Version,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [TransferItemID] = @TransferItemID,
        StuffID = @StuffID,
        AssetTitle = @AssetTitle,
        AssetTitle2 = @AssetTitle2,
        AccountingDate = @AccountingDate,
        AssetType = @AssetType,
        AssetCategoryID = @AssetCategoryID,
        SalvageValue = @SalvageValue,
        UsageDate = @UsageDate,
        DuringDepreciation = @DuringDepreciation
    WHERE [CreationID] = @CreationID;

    DECLARE @AssetID INT = NULL;

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
            RAISERROR('مانده تخصیص داده نشده فاکتور خرید شماره (%d) منفی خواهد شد.', 16, 12, @Num);
            RETURN;
        END;
    END;
    
    -- Begin Return Select <- do not remove
    SELECT [Version],
        [Number]
    FROM [AST].[Creation]
    WHERE [CreationID] = @CreationID;
    -- End Return Select <- do not remove
