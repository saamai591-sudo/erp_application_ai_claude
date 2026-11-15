

CREATE     PROCEDURE [AST].spRevaluationPreVoucherInsert
	@RevaluationId NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Revaluation'),
	            @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where de.Name = 'Revaluation'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
	            @CostDescription NVARCHAR(MAX),
				@CostDescription2 NVARCHAR(MAX),
					@DepreciationDescription NVARCHAR(MAX),
					@DepreciationDescription2 NVARCHAR(MAX),
				@BaseDigit int,
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt
	        
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		set @BaseDigit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@RevaluationId) 	


		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @CostDescription = Description,
				@CostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cost'   
      
	  	    
		select  @DepreciationDescription = Description,
			@DepreciationDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Depreciation'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by a.RevaluationID) PrevoucherID,	
			 	a.RevaluationID,
				a.FinancialPeriodID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,				
				a.Date,
				a.BranchId,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				a.Number
			into #Revaluation
	    FROM   AST.Revaluation a
		JOIN #DocumentIds b on a.RevaluationID = b.ID
		JOIN cfg.DimDate DD on DD.Date = a.Date
	    WHERE a.PreVoucherID is null        


		 select ri.assetid,
				ri.Value,
				h.PrevoucherID,
				h.RevaluationID,
				FixAsset,
				IncomeFromRevaluation,
				REPLACE(@AssetDescription,
					'@@AssetTitle@@',a.Title) AssetDescription,
				REPLACE(@AssetDescription2,
					'@@AssetTitle@@',a.Title2) AssetDescription2,
				REPLACE(@CostDescription,
					'@@AssetTitle@@',a.Title) CostDescription,
				REPLACE(@CostDescription2,
					'@@AssetTitle@@',a.Title2) CostDescription2
		 into #RevaluationItem
		from ast.RevaluationItem ri
		join #Revaluation h on h.RevaluationID = ri.RevaluationID
		join ast.Asset a on a.AssetID = ri.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		update a
		set ErrorMessage =  'RevaluationSlsNotSpecified'+char(10)+char(13)
		from #Revaluation a
		join #RevaluationItem b on a.RevaluationID = b.RevaluationID
		WHERE FixAsset is null or IncomeFromRevaluation is null

		-- Depreciation calculated together with this document (until the document date).
		-- An asset can have several AssetSettingID in one calculation (different DLs), so one row per AssetSettingID.
		select d.DocumentID RevaluationID, d.AssetID, d.AssetSettingID, sum(d.Value) Value
		into #DepreciationBySetting
		from ast.Depreciation d
		join #Revaluation h on h.RevaluationID = d.DocumentID
		where d.[Document] = 'Revaluation'
			and d.AssetID in (select AssetID from ast.RevaluationItem where RevaluationID = h.RevaluationID)
		group by d.DocumentID, d.AssetID, d.AssetSettingID
		having sum(d.Value) > 0

		CREATE TABLE #DepLines
		(
			PreVoucherID INT NULL,
			RevaluationID INT NULL,
			AssetID INT NULL,
			AssetSettingID INT NULL,
			SlID INT NULL,
			Debit DECIMAL(30,4) NULL,
			Credit DECIMAL(30,4) NULL,
			Description NVARCHAR(MAX) NULL,
			Description2 NVARCHAR(MAX) NULL,
			RowID INT IDENTITY(1,1) NOT NULL
		)

		-- Debit: depreciation cost
		insert into #DepLines (PreVoucherID, RevaluationID, AssetID, AssetSettingID, SlID, Debit, Credit, Description, Description2)
		select  h.PreVoucherID,
				h.RevaluationID,
				a.AssetID,
				dd.AssetSettingID,
				cat.DepreciationCost,
				dd.Value,
				0,
				ISNULL(REPLACE(REPLACE(@DepreciationDescription, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title), h.Description),
				ISNULL(REPLACE(REPLACE(@DepreciationDescription2, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title2), h.Description2)
		from ast.RevaluationItem a
		join #Revaluation h on h.RevaluationID = a.RevaluationID
		join ast.Asset s on s.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.RevaluationID = a.RevaluationID and dd.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = s.AssetCategoryID

		-- Credit: accumulated depreciation
		insert into #DepLines (PreVoucherID, RevaluationID, AssetID, AssetSettingID, SlID, Debit, Credit, Description, Description2)
		select  h.PreVoucherID,
				h.RevaluationID,
				a.AssetID,
				dd.AssetSettingID,
				cat.AccumulatedDepreciation,
				0,
				dd.Value,
				ISNULL(REPLACE(REPLACE(@DepreciationDescription, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title), h.Description),
				ISNULL(REPLACE(REPLACE(@DepreciationDescription2, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title2), h.Description2)
		from ast.RevaluationItem a
		join #Revaluation h on h.RevaluationID = a.RevaluationID
		join ast.Asset s on s.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.RevaluationID = a.RevaluationID and dd.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = s.AssetCategoryID

		update a
		set ErrorMessage = isnull(a.ErrorMessage, '') + 'RevaluationSlsNotSpecified'+char(10)+char(13)
		from #Revaluation a
		join #DepLines b on a.RevaluationID = b.RevaluationID
		where b.SlID is null
		if exists (select * from #Revaluation where ErrorMessage is not null )
		BEGIN	
			select RevaluationID,ErrorMessage from #Revaluation
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Revaluation
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Revaluation a
		join #Revaluation b on a.RevaluationID = b.RevaluationID
		    
		 -- debit
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
	    SELECT	PreVoucherId,1,case when Value > 0 then FixAsset else IncomeFromRevaluation end,
				case when Value > 0 then AssetDescription else CostDescription end,
				case when Value > 0 then AssetDescription2 else CostDescription2 end,
				abs(Value),0,-1,1,abs(Value),0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #RevaluationItem

		-- Credit
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
	    SELECT	PreVoucherId,1,case when Value < 0 then FixAsset else IncomeFromRevaluation end,
				case when Value < 0 then CostDescription else AssetDescription end,
				case when Value < 0 then CostDescription2 else AssetDescription2 end,
				0,abs(Value),-1,1,0,abs(Value),@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #RevaluationItem


		CREATE TABLE #ItemMap (RowID INT NOT NULL, PreVoucherItemID INT NOT NULL)

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #DepLines) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID, RowIndex, SlID, DESCRIPTION, Description2, Debit, Credit, CurrencyID, CurrencyRate, CurrencyDebit, CurrencyCredit, Creator, CreationDate, LastEditor, LastEditionDate, Version)
			VALUES (src.PreVoucherID, 1, src.SlID, src.Description, src.Description2, src.Debit, src.Credit, -1, 1, src.Debit, src.Credit, @CreatorId, GETDATE(), @CreatorId, GETDATE(), 0)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		-- DL of the depreciation lines comes from the exact AssetSettingID of the calculation
		INSERT INTO Acc.PreVoucherItemAccountLevel
			(PreVoucherItemID, AccountLevelID, DLID, [Value], Creator, CreationDate, LastEditor, LastEditionDate, Version)
		SELECT  im.PreVoucherItemID,
				a.AccountLevelID,
				d.DlID,
				NULL,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0
		FROM  #DepLines t
		join #ItemMap im on im.RowID = t.RowID
		join Acc.AccountLevelSL a on a.SlID = t.SlID
		join ast.AssetSettingDl d on d.AssetSettingID = t.AssetSettingID and d.DlTypeID = a.DlTypeID
		group by im.PreVoucherItemID, a.AccountLevelID, d.DlID
				;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #Revaluation i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID    

		update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #Revaluation i on pi.PrevoucherID = i.PrevoucherID

