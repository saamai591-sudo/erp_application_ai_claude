
CREATE   PROCEDURE [AST].spReceivedFromBranchPreVoucherInsert
	@ReceivedFromBranchId NVARCHAR(MAX)
--WITH ENCRYPTION
AS
Begin

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'ReceivedFromBranch' ),
	            @MDEntity INT = (select Top (1) de.ID from mdt.DmdEntity AS de  where de.[Name] = 'AmountReceivedFromBranch' ORDER BY de.ID),
				@MaxPrevoucherID int,
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt

		SET @CreatorId = cfg.GetuserID();		
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReceivedFromBranchId)

	

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ReceivedFromBranchID) PrevoucherID,
				ReceivedFromBranchID,
				c.DestinationBranchID  BranchID,
				c.FinancialPeriodID,
				c.date,
				N'بابت سند دریافت از شعبه' Description,
				N'For Receipt From Branch' Description2,
				cast(null as varchar(max)) ErrorMessage,
				f.StartDate,
				Number,
				c.SourceBranchID,
				c.DestinationBranchID,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #ReceivedFromBranch
	    FROM   AST.ReceivedFromBranch c
		JOIN #DocumentIds b on c.ReceivedFromBranchID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
		join cfg.FinancialPeriod f on f.FinancialPeriodID = c.FinancialPeriodID
		where c.PreVoucherID is null


		select d.AssetID, sum(Value) Value, ast2.AssetCategoryID
		into #Depreciation
		from ast.ReceivedFromBranchItem rfbi		
		join ast.Asset ast2 on ast2.ReceivedFromBranchItemID = rfbi.ReceivedFromBranchItemID
		join ast.Depreciation d on d.AssetID = ast2.AssetID
		join #ReceivedFromBranch h on h.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		where d.Date <= h.StartDate
		group by d.AssetID, ast2.AssetCategoryID

		select d.AssetID,ast2.AssetCategoryID, sum(Value) BaseValue
		into #AssetValue
		from ast.ReceivedFromBranchItem rfbi		
		join ast.Asset ast2 on ast2.ReceivedFromBranchItemID = rfbi.ReceivedFromBranchItemID
		join ast.[VWAssetValue] d on d.AssetID = ast2.AssetID
		join #ReceivedFromBranch h on h.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		where d.Date <= ast2.AssetCreationDate 
		group by d.AssetID, ast2.AssetCategoryID


		select rfb.ReceivedFromBranchID, a.AssetCategoryID,case when @CultureNo = 1 then ac.Title else ac.Title2 End AssetCategoryTitle
		,sls.FixAsset,sls.AccumulatedDepreciation,sls.TransfersBetweenBranches
		into #Items
		from #ReceivedFromBranch rfb
		join ast.ReceivedFromBranchItem rfbi on rfb.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		join ast.Asset a on rfbi.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID		
		join [AST].[FnFindCategoryAccount]() sls on a.AssetCategoryID = sls.AssetCategoryID		
		join ast.AssetCategory ac on a.AssetCategoryID = ac.AssetCategoryID
		

		update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.FixAssetSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where FixAsset is null
		----معین استهلاک انباشته در گروه دارایی تعیین نشده است.
		update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.AccumulatedDepreciationSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where AccumulatedDepreciation is null
		----------معین نقل و انتقالات بین شعب در گروه دارایی تعیین نشده است.
			update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.TransfersBetweenBranchesSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where TransfersBetweenBranches is null


		if exists (select * from #ReceivedFromBranch where ErrorMessage is not null )
		BEGIN	
			SELECT ReceivedFromBranchID,ErrorMessage from #ReceivedFromBranch
			where ErrorMessage is not null
			RETURN;
		END
		

		
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ReceivedFromBranch
		set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.ReceivedFromBranch a
		join #ReceivedFromBranch b on a.ReceivedFromBranchID = b.ReceivedFromBranchID



		-- Destination Branch Fix Asset (دارایی نزد شعبه‌ی مقصد)
	    INSERT INTO ACC.PreVoucherItem
			(PreVoucherID ,
			 RowIndex,
			 SlID,
			 DESCRIPTION ,
			 Description2,
			 Debit,
			 Credit,
			 CurrencyID ,
			 CurrencyRate,
			 CurrencyDebit,
			 CurrencyCredit,
			 Creator,
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version)
	    SELECT
			PreVoucherId,
			1,
			b.FixAsset,
			isnull(a.Description,c.Description),
			isnull(a.Description2,c.Description2),
			s.BaseValue,
			0,
			-1,
			1,
			s.BaseValue,
			0,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ReceivedFromBranchItem a
		join ast.Asset ast on a.ReceivedFromBranchItemID = ast.ReceivedFromBranchItemID
		join #AssetValue s on s.AssetID = ast.AssetID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID

		-- Destination Branch Accumulated Depreciation (استهلاک انباشته نزد شعبه‌ی مقصد)
	    INSERT INTO ACC.PreVoucherItem
			(PreVoucherID ,
			 RowIndex,
			 SlID,
			 DESCRIPTION ,
			 Description2,
			 Debit,
			 Credit,
			 CurrencyID ,
			 CurrencyRate,
			 CurrencyDebit,
			 CurrencyCredit,
			 Creator,
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version)
	    SELECT
			c.PreVoucherId,
			1,
			b.AccumulatedDepreciation ,
			isnull(a.Description,c.Description),
			isnull(a.Description2,c.Description2),
			0,
			isnull(s.AccumulatedDepreciation , 0) + isnull(s.DuringDepreciation,0),
			-1,
			1,
			0,
			isnull(s.AccumulatedDepreciation , 0) + isnull(s.DuringDepreciation,0),
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ReceivedFromBranchItem a		
		join ast.asset s on s.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID		
		where  (s.AccumulatedDepreciation >0 or s.DuringDepreciation >0)


		-------------Difference between accountlated depreciation and base value vouchered to transfersl

		 INSERT INTO ACC.PreVoucherItem
			(PreVoucherID ,
			 RowIndex,
			 SlID,
			 DESCRIPTION ,
			 Description2,
			 Debit,
			 Credit,
			 CurrencyID ,
			 CurrencyRate,
			 CurrencyDebit,
			 CurrencyCredit,
			 Creator,
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version)
		 SELECT
			c.PreVoucherId,
			1,
			b.TransfersBetweenBranches ,
			isnull(a.Description,c.Description),
			isnull(a.Description2,c.Description2),
			0,
			s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0),
			-1,
			1,
			0,
			s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0),
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		
		
	from ast.ReceivedFromBranchItem a		
		join ast.asset s on s.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID		
	where (s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0)) > 0


END

