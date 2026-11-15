
CREATE   PROCEDURE [AST].spAssetReceiptPreVoucherInsert
	@AssetReceiptID NVARCHAR(MAX)
--WITH ENCRYPTION
	 AS
set NOCOUNT on
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID FROM   CFG.DocumentNumType WHERE EngName = 'AssetReceipt'),
	            @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'AssetReceipt'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
	            @OpositSideDescription NVARCHAR(MAX),
				@OpositSideDescription2 NVARCHAR(MAX),
		        @OperationCostDescription NVARCHAR(MAX),
				@OperationCostDescription2 NVARCHAR(MAX),
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt

		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@AssetReceiptID)

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @OpositSideDescription = Description,
				@OpositSideDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'OpositSide'

		select  @OperationCostDescription = Description,
				@OperationCostDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'OperationCost'


		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(ORDER BY c.AssetReceiptID) PrevoucherID,
				c.AssetReceiptID,
	            CreationType,
				c.BranchID ,
				c.FinancialPeriodID,
				c.date,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				cast(null as varchar(max)) ErrorMessage,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				c.Number
			into #AssetReceiptHeader
	    FROM   AST.AssetReceipt as  c
		JOIN #DocumentIds b on c.AssetReceiptID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
	    WHERE c.PreVoucherID is null


    --- Items (one row per created asset) ---
	    SELECT
				c.AssetReceiptID,
	            CreationType,
				a.BranchID ,
				c.FinancialPeriodID,
				ISNULL(ari.PurchaseInvoiceItemID,pii.PurchaseInvoiceItemID) PurchaseInvoiceItemID,
				c.date,
				a.AssetCategoryID,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				cast(null as varchar(max)) ErrorMessage,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				@AssetDescription AssetDescription,
				@AssetDescription2 AssetDescription2,
				@OpositSideDescription OpositSideDescription,
				@OpositSideDescription2 OpositSideDescription2,
				case when @CultureNo = 1 then ac.Title else ac.Title2 end AssetCategoryTitle,
				c.Number,
				a.Title AssetTitle,
				a.Title2 AssetTitle2,
				ari.AssetReceiptItemID,
				oi.OutgoingItemID,
				ai.AssetItemID,
				a.AssetID,
				a.BaseValue AssetBaseValue,
				COALESCE(ai.CostValue, ari.CostValue, a.BaseValue) ItemCostValue,
				ari.BaseValue ItemBaseValue,
				ari.CostValue ReceiptItemCostValue,
				ISNULL(a.AccumulatedDepreciation,0) AssetAccumulatedDepreciation
			into #AssetReceiptBase
	    FROM   AST.AssetReceipt as  c
	    join ast.AssetReceiptItem AS ari on ari.AssetReceiptID = c.AssetReceiptID
	    left join vnd.PurchaseInvoiceItem AS pii on ari.AssetReceiptItemID = pii.AssetReceiptItemID
	    left join stc.OutgoingItem AS oi on oi.OutgoingItemID = ari.OutgoingItemID
	    join ast.AssetItem AS ai on ai.AssetReceiptItemID = ari.AssetReceiptItemID
	    join ast.Asset AS a on a.AssetID = ai.AssetID
		JOIN #DocumentIds b on c.AssetReceiptID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
		left join ast.AssetCategory ac on ac.AssetCategoryID = a.AssetCategoryID
	    WHERE c.PreVoucherID is null


		-- مبلغ هر ردیف سند از سطح AssetItem محاسبه می شود، نه از کل دارایی:
		-- یک دارایی می تواند از چند ردیف رسید ساخته شود (چند AssetItem با یک AssetID) و Asset.BaseValue شامل سهم هزینه های بهره برداری هم هست
		--   ItemCost   = بهای این AssetItem به همراه سهم هزینه های بهره برداری (ai.CostValue)
		--   BasePart   = بخش بدون هزینه بهره برداری (به نسبت ari.BaseValue / ari.CostValue) که به طرف مقابل (تامین کننده و ...) بستانکار می شود
		--   AccumAlloc = سهم این AssetItem از استهلاک انباشته دارایی (به نسبت بها)
		select a.AssetItemID,
			   cast(round(case when isnull(a.ReceiptItemCostValue,0) > 0 and a.ItemBaseValue is not null
							   then cast(a.ItemCostValue as float) * cast(a.ItemBaseValue as float) / cast(a.ReceiptItemCostValue as float)
							   else cast(a.ItemCostValue as float) end, 4) as decimal(30,4)) BasePart,
			   cast(round(case when s.Total > 0 then cast(a.AssetAccumulatedDepreciation as float) * cast(a.ItemCostValue as float) / cast(s.Total as float) else 0 end, 4) as decimal(30,4)) AccumAlloc,
			   cast(a.ItemCostValue as decimal(30,4)) ItemCost
		into #ItemAmounts
		from #AssetReceiptBase a
		join (select AssetID, sum(ItemCostValue) Total from #AssetReceiptBase group by AssetID) s on s.AssetID = a.AssetID

		select b.*,
			   m.BasePart - m.AccumAlloc CreditCost
		into #AssetReceipt
		from #AssetReceiptBase b
		join #ItemAmounts m on m.AssetItemID = b.AssetItemID
		UPDATE a
		SET    ErrorMessage = N'AssetManager.Messages.AssetIsNotCreated' + CHAR(10) + CHAR(13)
		FROM   #AssetReceiptHeader a
		       left JOIN (
		                SELECT SUM(ari.MainQuantity) ReceiptQuantity,
		                       ari.AssetReceiptID,
		                       MAX(ar.AssetQuantity) AssetQuantity
		                FROM   ast.AssetReceiptItem AS ari
		                       left JOIN (
		                                SELECT ari2.AssetReceiptID,
		                                       SUM(ai.MainQuantity) AssetQuantity
		                                FROM   ast.AssetItem AS ai
		                                       JOIN ast.AssetReceiptItem AS ari2
		                                            ON  ari2.AssetReceiptItemID = ai.AssetReceiptItemID
		                                GROUP BY
		                                       ari2.AssetReceiptID
		                       ) ar on ari.AssetReceiptID = ar.AssetReceiptID
		                GROUP BY ari.AssetReceiptID
		            ) c
		            ON  a.AssetReceiptID = c.AssetReceiptID
		WHERE  ISNULL(c.ReceiptQuantity,0)<> ISNULL(c.AssetQuantity,0)


		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'AssetManager.Messages.BaseValueIsNotSepecifiedInCreatedAsset'+char(10)+char(13)
		from #AssetReceipt a
		join ast.Asset b on a.AssetID = b.AssetID
		WHERE b.BaseValue = 0

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'AssetManager.Messages.AssetCategoryHasNotSet'+char(10)+char(13)
		from #AssetReceipt a
		WHERE  AssetCategoryID is null

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'AssetManager.Messages.EstablishmentCreationDoesnotHaveVoucher'+char(10)+char(13)
		from #AssetReceipt a
		WHERE  CreationType = 1

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + 'AssetManager.Messages.FixAssetSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #AssetReceipt a
		join [AST].[FnFindCategoryAccount]() b on a.AssetCategoryID = b.AssetCategoryID
		WHERE  FixAsset is null

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'AssetManager.Messages.PurchaseControlInPurchasedStuff'+char(10)+char(13)
		from #AssetReceipt a
		join vnd.PurchaseInvoiceItem pii on a.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
		join vnd.PurchaseInvoice pi1 on pi1.PurchaseInvoiceID = pii.PurchaseInvoiceID
		join stf.StuffDetail sd on pii.StuffID = sd.StuffID
		left join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = pi1.Type
		where case when sd.SlID is null then sagpt.SlID else sd.SlID end is null

		-- معین طرف مقابل در اسناد خروج انبار: در صورتی که معین بر اساس تفصیلی تعیین می شود باید تفصیلی تحویل گیرنده هم در نظر گرفته شود
		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'AssetManager.Messages.AssetControlInRemittedStuff'+char(10)+char(13)
		from #AssetReceipt a
		join stc.OutgoingItem oi on a.OutgoingItemID = oi.OutgoingItemID
		join stc.Outgoing o on o.OutgoingID = oi.OutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		join stf.StuffDetail sd on oi.StuffID = sd.StuffID
		left join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
		where not exists
		(
			select 1
			from stf.StockDocumentTypeSlDl wip
			where wip.StuffAccountGroupID = sag.StuffAccountGroupID
			and wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
			and (sdt.SlBaseOnDl = 0 or wip.DlID = o.DeliverDlID)
			and wip.SlID is not null
		)


		update a
		set ErrorMessage =  isnull(ErrorMessage,'') +'AssetManager.Messages.CompelementingAssetSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #AssetReceipt a
		join [AST].[FnFindCategoryAccount]() b on a.AssetCategoryID = b.AssetCategoryID
		WHERE  CompletingAsset is null and CreationType = 4

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + N'معین نقل و انتقالات بین شعب در گروه دارایی ' + isnull(AssetCategoryTitle,'') + N' انتخاب نشده است.' +char(10)+char(13)
		from #AssetReceipt a
		join [AST].[FnFindCategoryAccount]() b on a.AssetCategoryID = b.AssetCategoryID
		WHERE  TransfersBetweenBranches is null and CreationType = 7

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') +'AssetManager.Messages.AssetControlInConfig'+char(10)+char(13)
		from #AssetReceipt a
		join [AST].[FnFindCategoryAccount]() b on a.AssetCategoryID = b.AssetCategoryID
		WHERE  (select ConfigValue from cfg.Configuration where ConfigKey = 'AssetControlSl') is null and CreationType = 5

		--- Utilization costs (هزینه های بهره برداری) ---
		create table #RCtemps
		(
			DlID bigint,
			Slid int,
			Price decimal(36,10),
			PrevoucherID bigint,
			Description nvarchar(max),
			Description2 nvarchar(max),
			UtilizationCostID int,
			AssetReceiptID int
		)

		-- هزینه های بهره برداری که از روی فاکتور خرید ثبت شده اند
		-- برای خدمات (Type = 1) معین از StuffDetail خوانده می شود و ممکن است گروه حساب/نوع خرید نداشته باشند، پس LEFT JOIN
		insert into #RCtemps (DlID,Slid,Price,PrevoucherID,Description,Description2,UtilizationCostID,AssetReceiptID)
	    SELECT
				pi1.DlID,
				CASE
	    	        WHEN s.type = 1 THEN sd.SlID
	    	        else sagpt.SlID
	    	    END               Slid,
	            rc.Price,
	            st.PrevoucherID,
				@OperationCostDescription Description,
				@OperationCostDescription2 Description2,
				rc.AssetReceiptUtilizationCostID,
				rc.AssetReceiptID
	    FROM    ast.AssetReceiptUtilizationCost  rc
	    INNER JOIN #AssetReceiptHeader St ON  St.AssetReceiptID = Rc.AssetReceiptID
	    INNER JOIN STF.[Stuff] s ON  rc.StuffID = s.StuffID
	    INNER JOIN stf.StuffDetail sd ON  rc.StuffID = sd.StuffID
	    INNER JOIN  vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = rc.PurchaseInvoiceItemID
		INNER JOIN  vnd.PurchaseInvoice pi1 on pi1.PurchaseInvoiceID = pii.PurchaseInvoiceID
	    LEFT JOIN  stf.StuffAccountGroup sag
	    	ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN  stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = pi1.Type
		WHERE rc.PurchaseInvoiceItemID is not null

		-- هزینه های بهره برداری که از روی حواله خروج ثبت شده اند
		insert into #RCtemps (DlID,Slid,Price,PrevoucherID,Description,Description2,UtilizationCostID,AssetReceiptID)
	    SELECT
				o.DeliverDlID,
				w.SlID,
	            rc.Price,
	            st.PrevoucherID,
				@OperationCostDescription Description,
				@OperationCostDescription2 Description2,
				rc.AssetReceiptUtilizationCostID,
				rc.AssetReceiptID
	    FROM    ast.AssetReceiptUtilizationCost As rc
	    INNER JOIN #AssetReceiptHeader St ON  St.AssetReceiptID = Rc.AssetReceiptID
	    INNER JOIN stf.StuffDetail sd ON  rc.StuffID = sd.StuffID
	    LEFT JOIN stf.StuffAccountGroup sag
	    	ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
		INNER JOIN stc.OutgoingItem oi on rc.OutgoingItemID = oi.OutgoingItemID
		INNER JOIN stc.Outgoing o on o.OutgoingID = oi.OutgoingID
		INNER JOIN stc.StockDocumentTypeBaseEntity sdtbe
			on sdtbe.StockDocumentTypeBaseEntityID = o.StockDocumentTypeBaseEntityID
		INNER JOIN stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
		OUTER APPLY
		(
			select top 1 sdtsd.SlID
			from stf.StockDocumentTypeSlDl sdtsd
			where sdtsd.StockDocumentTypeID = sdtbe.StockDocumentTypeID
			and sdtsd.StuffAccountGroupID = sag.StuffAccountGroupID
			and (sdt.SlBaseOnDl = 0 or sdtsd.DlID = o.DeliverDlID)
			and sdtsd.SlID is not null
			order by sdtsd.SlID
		) w
		WHERE rc.OutgoingItemID is not null

		update h
		set ErrorMessage =  isnull(ErrorMessage,'') + N'برخی از هزینه های بهره برداری فاقد معین هستند' + char(10)+char(13)
		from #AssetReceiptHeader h
		where exists (select 1 from #RCtemps r where r.AssetReceiptID = h.AssetReceiptID and r.Slid is null)

		-- هر خطایی (چه در سطح سند و چه در سطح دارایی) قبل از هر گونه درج گزارش می شود
		if exists (select 1 from #AssetReceiptHeader where ErrorMessage is not null)
			or exists (select 1 from #AssetReceipt where ErrorMessage is not null)
		BEGIN
			SELECT AssetReceiptID,ErrorMessage from #AssetReceiptHeader
			where ErrorMessage is not null
			UNION
			SELECT AssetReceiptID,ErrorMessage from #AssetReceipt
			where ErrorMessage is not null
			RETURN;
		END

		--- Voucher lines ---
		create table #Lines
		(
			RowID int identity(1,1) not null,
			Kind tinyint not null,           -- 1: بدهکار دارایی ثابت، 2: بستانکار طرف مقابل، 3: بستانکار هزینه بهره برداری
			PreVoucherID bigint not null,
			AssetReceiptID int not null,
			SlID int null,
			Debit decimal(30,4) not null,
			Credit decimal(30,4) not null,
			Description nvarchar(max) null,
			Description2 nvarchar(max) null,
			DlID bigint null,
			BaseDocumentName varchar(100) null,
			BaseDocumentID int null,
			AssetTitle nvarchar(max) null,
			AssetTitle2 nvarchar(max) null
		)

		-- بدهکار: دارایی ثابت؛ یک سطر به ازای هر دارایی با مبلغ Asset.BaseValue (که شامل سهم هزینه های بهره برداری است) منهای استهلاک انباشته
		-- (یک دارایی ممکن است از چند ردیف رسید ساخته شود، پس سطرهای #AssetReceipt بر اساس AssetID یکتا می شوند)
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,AssetTitle,AssetTitle2)
		select  1,
				h.PrevoucherID,
				a.AssetReceiptID,
				c.FixAsset,
				a.AssetBaseValue - a.AssetAccumulatedDepreciation,
				0,
				a.AssetDescription,
				a.AssetDescription2,
				a.AssetTitle,
				a.AssetTitle2
		from
		(
			select AssetReceiptID, AssetID,
				   min(AssetItemID) FirstAssetItemID,
				   max(AssetCategoryID) AssetCategoryID,
				   max(AssetBaseValue) AssetBaseValue,
				   max(AssetAccumulatedDepreciation) AssetAccumulatedDepreciation,
				   max(AssetDescription) AssetDescription,
				   max(AssetDescription2) AssetDescription2,
				   max(AssetTitle) AssetTitle,
				   max(AssetTitle2) AssetTitle2
			from #AssetReceipt
			group by AssetReceiptID, AssetID
		) a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = a.AssetCategoryID
		where a.AssetBaseValue - a.AssetAccumulatedDepreciation > 0
		order by a.AssetReceiptID, a.FirstAssetItemID

		-- بستانکار: تامین کننده (فاکتور خرید)
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,DlID,AssetTitle,AssetTitle2)
		select  2,
				h.PrevoucherID,
				a.AssetReceiptID,
				case when sd.SlID is null then sagpt.SlID else sd.SlID end,
				0,
				a.CreditCost,
				a.OpositSideDescription,
				a.OpositSideDescription2,
				pi1.DlID,
				a.AssetTitle,
				a.AssetTitle2
		from #AssetReceipt a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		join vnd.PurchaseInvoiceItem pii on a.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
		join vnd.PurchaseInvoice pi1 on pi1.PurchaseInvoiceID = pii.PurchaseInvoiceID
		join stf.StuffDetail sd on pii.StuffID = sd.StuffID
		left join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = pi1.Type
		where a.CreditCost > 0
		order by a.AssetReceiptID, a.AssetItemID

		-- بستانکار: حواله خروج انبار
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,DlID,AssetTitle,AssetTitle2)
		select  2,
				h.PrevoucherID,
				a.AssetReceiptID,
				w.SlID,
				0,
				a.CreditCost,
				a.OpositSideDescription,
				a.OpositSideDescription2,
				o.DeliverDlID,
				a.AssetTitle,
				a.AssetTitle2
		from #AssetReceipt a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		join stc.OutgoingItem oi on a.OutgoingItemID = oi.OutgoingItemID
		join stc.Outgoing o on o.OutgoingID = oi.OutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		join stf.StuffDetail sd on oi.StuffID = sd.StuffID
		left join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
		outer apply
		(
			select top 1 wip.SlID
			from stf.StockDocumentTypeSlDl wip
			where wip.StuffAccountGroupID = sag.StuffAccountGroupID
			and wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
			and (sdt.SlBaseOnDl = 0 or wip.DlID = o.DeliverDlID)
			and wip.SlID is not null
			order by wip.SlID
		) w
		where a.CreditCost > 0
		order by a.AssetReceiptID, a.AssetItemID

		-- بستانکار: تکمیل دارایی (CreationType = 4)
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,AssetTitle,AssetTitle2)
		select  2,
				h.PrevoucherID,
				a.AssetReceiptID,
				c.CompletingAsset,
				0,
				a.CreditCost,
				a.OpositSideDescription,
				a.OpositSideDescription2,
				a.AssetTitle,
				a.AssetTitle2
		from #AssetReceipt a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = a.AssetCategoryID
		where h.CreationType = 4
		and a.CreditCost > 0
		order by a.AssetReceiptID, a.AssetItemID

		-- بستانکار: معین کنترل دارایی (CreationType = 5)
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,AssetTitle,AssetTitle2)
		select  2,
				h.PrevoucherID,
				a.AssetReceiptID,
				(select cast(ConfigValue as int) from cfg.Configuration where ConfigKey = 'AssetControlSl'),
				0,
				a.CreditCost,
				a.OpositSideDescription,
				a.OpositSideDescription2,
				a.AssetTitle,
				a.AssetTitle2
		from #AssetReceipt a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		where h.CreationType = 5
		and a.CreditCost > 0
		order by a.AssetReceiptID, a.AssetItemID

		-- بستانکار: نقل و انتقالات بین شعب (CreationType = 7)
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,AssetTitle,AssetTitle2)
		select  2,
				h.PrevoucherID,
				a.AssetReceiptID,
				c.TransfersBetweenBranches,
				0,
				a.CreditCost,
				a.OpositSideDescription,
				a.OpositSideDescription2,
				a.AssetTitle,
				a.AssetTitle2
		from #AssetReceipt a
		join #AssetReceiptHeader h on a.AssetReceiptID = h.AssetReceiptID
		join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = a.AssetCategoryID
		where h.CreationType = 7
		and a.CreditCost > 0
		order by a.AssetReceiptID, a.AssetItemID

		-- بستانکار: هزینه های بهره برداری
		insert into #Lines (Kind,PreVoucherID,AssetReceiptID,SlID,Debit,Credit,Description,Description2,DlID,BaseDocumentName,BaseDocumentID,AssetTitle,AssetTitle2)
		select  3,
				r.PrevoucherID,
				r.AssetReceiptID,
				r.Slid,
				0,
				r.Price,
				r.Description,
				r.Description2,
				r.DlID,
				'UtilizationCost',
				r.UtilizationCostID,
				t.AssetTitle,
				t.AssetTitle2
		from #RCtemps r
		left join (select AssetReceiptID, min(AssetTitle) AssetTitle, min(AssetTitle2) AssetTitle2 from #AssetReceipt group by AssetReceiptID) t on t.AssetReceiptID = r.AssetReceiptID
		where r.Price > 0
		order by r.AssetReceiptID, r.UtilizationCostID

		-- جایگزینی متغیرهای شرح ردیف ها
		update l
		set Description =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(l.Description,
						'@@AssetTitle@@',isnull(l.AssetTitle,'')),
						'@@Number@@',isnull(cast(h.Number as nvarchar(50)),'')),
						'@@Date_Gregorian@@',isnull(cast(h.FullDateAlternateKey as nvarchar(50)),'')),
						'@@Date_Solar@@',isnull(cast(h.PersianFullDateAlternateKey as nvarchar(50)),'')),
			Description2 =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(l.Description2,
						'@@AssetTitle@@',isnull(l.AssetTitle2,'')),
						'@@Number@@',isnull(cast(h.Number as nvarchar(50)),'')),
						'@@Date_Gregorian@@',isnull(cast(h.FullDateAlternateKey as nvarchar(50)),'')),
						'@@Date_Solar@@',isnull(cast(h.PersianFullDateAlternateKey as nvarchar(50)),''))
		from #Lines l
		join #AssetReceiptHeader h on h.PrevoucherID = l.PreVoucherID

		-- جایگزینی متغیرهای شرح سربرگ سند (عنوان دارایی: اولین دارایی سند)
		update h
		set Description =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(h.Description,
						'@@AssetTitle@@',isnull(t.AssetTitle,'')),
						'@@Number@@',isnull(cast(h.Number as nvarchar(50)),'')),
						'@@Date_Gregorian@@',isnull(cast(h.FullDateAlternateKey as nvarchar(50)),'')),
						'@@Date_Solar@@',isnull(cast(h.PersianFullDateAlternateKey as nvarchar(50)),'')),
			Description2 =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(h.Description2,
						'@@AssetTitle@@',isnull(t.AssetTitle2,'')),
						'@@Number@@',isnull(cast(h.Number as nvarchar(50)),'')),
						'@@Date_Gregorian@@',isnull(cast(h.FullDateAlternateKey as nvarchar(50)),'')),
						'@@Date_Solar@@',isnull(cast(h.PersianFullDateAlternateKey as nvarchar(50)),''))
		from #AssetReceiptHeader h
		left join (select AssetReceiptID, min(AssetTitle) AssetTitle, min(AssetTitle2) AssetTitle2 from #AssetReceipt group by AssetReceiptID) t on t.AssetReceiptID = h.AssetReceiptID

		-- سند باید بالانس باشد
		if exists (select 1 from #Lines group by PreVoucherID having sum(Debit) <> sum(Credit))
		BEGIN
			select h.AssetReceiptID, N'مجموع بدهکار و بستانکار سند برابر نیست.' ErrorMessage
			from #AssetReceiptHeader h
			join (select PreVoucherID from #Lines group by PreVoucherID having sum(Debit) <> sum(Credit)) x on x.PreVoucherID = h.PrevoucherID
			RETURN;
		END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #AssetReceiptHeader
		set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.AssetReceipt  a
		join #AssetReceiptHeader b on a.AssetReceiptID = b.AssetReceiptID

		-- درج ردیف های سند؛ نگاشت هر ردیف به PreVoucherItemID برای درج تفصیلی
		create table #LineMap (RowID int not null, PreVoucherItemID int not null)

		-- بدهکار: دارایی ثابت
		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #Lines where Kind = 1) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,src.Credit,-1,1,src.Debit,src.Credit,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0)
		OUTPUT src.RowID, inserted.PreVoucherItemID INTO #LineMap(RowID, PreVoucherItemID);

		-- بستانکار: طرف مقابل
		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #Lines where Kind = 2) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,src.Credit,-1,1,src.Debit,src.Credit,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0)
		OUTPUT src.RowID, inserted.PreVoucherItemID INTO #LineMap(RowID, PreVoucherItemID);

		-- بستانکار: هزینه های بهره برداری
		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #Lines where Kind = 3) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,IsAutoGenerated,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,src.Credit,-1,1,src.Debit,src.Credit,1,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,src.BaseDocumentName,src.BaseDocumentID)
		OUTPUT src.RowID, inserted.PreVoucherItemID INTO #LineMap(RowID, PreVoucherItemID);

		-- تفصیلی هر ردیف فقط از روی تفصیلی همان ردیف (تامین کننده، تحویل گیرنده حواله و ...) پر می شود
	    INSERT INTO Acc.PreVoucherItemAccountLevel
	        (
	        PreVoucherItemID,
	        AccountLevelID,
	        DLID,
	        [Value],
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	        )
	    SELECT  m.PreVoucherItemID,
	            al.AccountLevelID,
	            dl.DLID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
	    FROM   #Lines l
		join #LineMap m on m.RowID = l.RowID
		join Acc.AccountLevelSL al on al.SlID = l.SlID
		join acc.DL dl on dl.DLID = l.DlID and dl.DlTypeID = al.DlTypeID
		where l.DlID is not null
		group by m.PreVoucherItemID, al.AccountLevelID, dl.DLID

		-- شماره ردیف ها
		;with temp as
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex
			from #AssetReceiptHeader h
			join acc.PreVoucherItem [pi] on [pi].PreVoucherID = h.PreVoucherID
		)
		update v
		set RowIndex = t.RowIndex
		from acc.PreVoucherItem v
		join temp t on v.PreVoucherItemID = t.PreVoucherItemID

