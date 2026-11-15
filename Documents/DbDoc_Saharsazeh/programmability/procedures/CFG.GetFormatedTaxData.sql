------------------------------------- START #9504
CREATE     PROCEDURE [CFG].GetFormatedTaxData
(@docInfo StringArrayInput READONLY, @CompanyID INT)
AS
BEGIN
	DECLARE
		@ItemTableName		NVARCHAR(MAX),
	    @HeaderTableName	NVARCHAR(MAX),
	    @Query				NVARCHAR(MAX),
	    @SourceTable		NVARCHAR(MAX);

	DECLARE @UniqueTaxID         NVARCHAR(200),
	        @NationalId          NVARCHAR(200),
	        @maxRecordNumber     BIGINT;
	
	SELECT @maxRecordNumber = MAX(td.RowID)
	FROM   CFG.TaxData AS td;
	
	IF @maxRecordNumber IS NULL
	    SET @maxRecordNumber = 0;
	
	SELECT @NationalId =case when type in (0,4) then c.EconomicCode else c.NationalId end
	FROM   CFG.Company AS c
	WHERE  c.CompanyID = @CompanyID

	SELECT @UniqueTaxID = ctd.UniqueTaxID
	FROM   CFG.CompanyTaxData AS ctd
	WHERE  ctd.CompanyID = @CompanyID
	
	SET @HeaderTableName = cfg.getTempTableName(1)
	SET @ItemTableName =   cfg.getTempTableName(1)
	
	
	DROP TABLE 
	IF EXISTS #myTemp
	    ;
	
	DROP TABLE 
	IF EXISTS #baseData
	    ;
	
	DROP TABLE 
	IF EXISTS #headResult
	    ;
	
	
	SELECT *
	INTO   #Stuff
	FROM   stf.VWStuff AS v
	
	
	---Fetch Data
	EXEC cfg.spTaxDataSource
		@fromDate = null,
		@toDate = null,
		@FinancialPeriodID = null,
		@CompanyID = null,
		@ItemTableName = @ItemTableName,
		@HeaderTableName = @HeaderTableName,
		@Selected = @docInfo
		
		
		CREATE TABLE #SourceData
		(
			
			DocumentID int,
			DocumentName NVARCHAR(MAX),
			inp NVARCHAR(10),
			Number int,
			[Date] datetime,
			 PartyID BIGINT,
			ParentInvoiceID int,
			CurrencyID int,
			CurrencyRate DECIMAL(36,10),
			FinancialPeriodID int,
			BranchID int,
			TotalPrice DECIMAL(36,10),
			TotalDiscount DECIMAL(36,10),
			TotalNetPrice DECIMAL(36,10),
			TotalVat DECIMAL(36,10),
			TotalMainQuantity  DECIMAL(36,10),
			StuffID int,
			MainQuantity DECIMAL (36,10),
			Fee DECIMAL (36,10),
			Price DECIMAL (36,10),
			Discount DECIMAL (36,10),
			Vat DECIMAL (36,10),
			NetPrice DECIMAL (36,10),
			RowWeight DECIMAL (36,10),
			CustomWeight DECIMAL (36,10),
			StuffUniqueTaxID NVARCHAR(50),
			ins NVARCHAR(10),
		    NonReceived DECIMAL(36,10),
		    CurrencyISOCode NVARCHAR(10),
			inty NVARCHAR(10),
			ParentInvoiceUniqueTaxID Nvarchar(50),
			Settellment TINYINT,
			CottageNumber	nvarchar(50),
			CottageDate		DATE,
			RowNumber int
			)	


	SET @Query = N'	
	insert into #SourceData
	SELECT 
	                t.DocumentID,
	                t.DocumentName,
	                t.inp,
	                t.Number,
	                 CAST(t.Date AS DATETIME) + ''13:00:00'' [Date],
	                t. PartyID,
	                t.ParentInvoiceID,
	                t.CurrencyID,
	                t.CurrencyRate,
	                t.FinancialPeriodID,
	                t.BranchID,
	                CASE WHEN th.TotalMainQuantity>0  THEN th.TotalPrice ELSE ISNULL(th.BaseTotalPrice,0) End  TotalPrice,
	                CASE WHEN th.TotalMainQuantity>0  THEN th.TotalDiscount ELSE ISNULL(th.BaseTotalDiscount,0) END  TotalDiscount,
	                CASE WHEN th.TotalMainQuantity>0  THEN th.TotalNetPrice ELSE ISNULL(th.BaseTotalNetPrice,0) END   TotalNetPrice,
	                CASE WHEN th.TotalMainQuantity>0  THEN th.TotalVat ELSE ISNULL(th.BaseTotalVat,0) END  TotalVat,
	                th.TotalMainQuantity,
	                t.StuffID,
	                t.MainQuantity,
	                t.Fee,
	                t.Price,
	                t.Discount,
	                t.Vat,
	                t.NetPrice,
	                t.RowWeight,
	                t.CustomWeight,
	                t.StuffUniqueTaxID,
	                th.ins,
	                inr.NonReceived,
	                th.CurrencyISOCode          ,
					th.inty,
					t.ParentInvoiceUniqueTaxID,
					th.Settellment,
					t.CottageNumber,
					t.CottageDate,
					t.RowNumber
	FROM '+@ItemTableName + N' AS t
	JOIN '+@HeaderTableName +N' th ON t.DocumentName = th.DocumentName AND t.DocumentID = th.DocumentID
	Left Join sle.SaleType st on th.SaleTypeID = st.SaleTypeID
	Left Join sle.Invoice_NonReceived inr on t.DocumentID = inr.InvoiceID and t.DocumentName = ''Invoice''
	'
	
EXEC (@Query)

---FindContractsUniqueTax
	SELECT a.DocumentID,
	a.[Value]                        ContractUniqueTax
	into #ContractUniqueTax
	from (
	select 
	cs.ConfirmStatementID DocumentID,
	ecfd.[Value]
	FROM   cnt.ConfirmStatement             AS cs
	JOIN cnt.[Contract]              AS c
		ON  c.ContractID = cs.ContractID
	JOIN cfg.EntityCustomeFieldData  AS ecfd
		ON  c.ContractID = ecfd.EntityID
	JOIN cfg.EntityCustomeField      AS ecf
		ON  ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
		AND ecf.FieldName = 'ContractUniqueTaxID'
		and ecf.EntityName = 'EmployerContractDefinition'
		union all
		select ii.InvoiceID,ecfd.Value from sle.InvoiceItem ii
		join cnt.ContractSubject cs on  ii.ContractSubjectID = cs.ContractSubjectID
		join cnt.Contract c on cs.ContractID = c.ContractID
		JOIN cfg.EntityCustomeFieldData  AS ecfd
		ON  c.ContractID = ecfd.EntityID
	JOIN cfg.EntityCustomeField      AS ecf
		ON  ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
		AND ecf.FieldName = 'ContractUniqueTaxID'
		and ecf.EntityName = 'EmployerContractDefinition'
		group by ii.InvoiceID,ecfd.Value) a

	----درج اطلاعات فاکتور و برگشتی با فرمت درخواستی مالیات
	SELECT src.Number                 AS RowIndex,
			src.RowNumber,
	       '@UniqueTaxID'                taxid,
	       RIGHT(sys.fn_varbintohexstr(CONVERT(BINARY(16), src.Number)), 10) AS inno,
	       CAST(
	           DATEDIFF_BIG(ms, '1970-01-01 00:00:00', src.Date) AS NVARCHAR(18)
	       )                             indatim,
	       CAST(
	           DATEDIFF_BIG(ms, '1970-01-01 00:00:00', src.Date) AS NVARCHAR(18)
	       )                          AS Indati2m,
	       src.DocumentName,
	       src.DocumentID,
	       src.Number                    Number,
	       src.Date                   AS [Date],
	       src.inty,
	       src.ParentInvoiceUniqueTaxID             AS irtaxid,
	       src.inp                    AS inp,
	       src.ins                    AS ins,
	       @NationalId                AS tins,
	       CASE WHEN p.[Type] = 4 THEN p.EconomicCode
	            WHEN p.NationalID IS NOT NULL THEN p.NationalID
	            WHEN p.FidaIdCode IS NOT NULL THEN NULL
	            WHEN p.IdentificationCode IS NOT NULL THEN p.EconomicCode
	       END                        AS tinb,
	       CASE 
	            WHEN p.FidaIdCode IS NOT NULL THEN '4'
	            WHEN p.Type = 0 THEN '1'
	            WHEN p.Type <> 0 THEN '2'
	       END                        AS tob,
	       NULL                       AS sbc,
	       CASE 
	            WHEN src.inty = 2 THEN NULL
	            ELSE CASE 
	                      WHEN ISNULL(p.NationalID, '') <> '' THEN p.NationalID
	                      WHEN ISNULL(p.FidaIdCode, '') <> '' THEN p.FidaIdCode
	                      WHEN ISNULL(p.IdentificationCode, '') <> '' THEN p.IdentificationCode
	                 END
	       END                        AS bid,
	       adrss.ZipCode              AS bpc,
	       BuyerBranch.[Value]        AS bbc,
	       NULL                       AS bpn,
	       NULL                       AS ft,
	       ''                         AS scln,
	       NULL                       AS scc,
	       CASE 
	            WHEN inp = '4' THEN cut.ContractUniqueTax
	            ELSE NULL
	       END                        AS crn,
	       src.CottageNumber          AS cdcn,
	       cast(floor(datediff(s,'1970-01-01 00:00:00',src.CottageDate)/86400) as nvarchar(5))        AS cdcd,
	       ''                         AS billid,
		   --case when src.inp = '7' then null else 
	    --   CAST(CAST(round(src.TotalPrice*src.CurrencyRate,0) AS DECIMAL(18, 0)) AS NVARCHAR(18)) end AS tprdis,
	      --CAST(CAST(round(src.TotalDiscount * src.CurrencyRate,0) AS DECIMAL(18, 0)) AS NVARCHAR(18))  AS tdis,
		   --case when src.inp = '7' then null else 
	    --   CAST(
	    --       CAST(round((src.TotalPrice - src.TotalDiscount)*src.CurrencyRate,0) AS DECIMAL(18, 0)) AS NVARCHAR(18)
	    --   )                     end     AS tadis,
	       --CAST(CAST(CASE WHEN inp = '4' then src.TotalVat else  round(src.TotalVat*src.CurrencyRate,0) End AS DECIMAL(18, 0)) AS NVARCHAR(18)) AS tvam,
	       '0'                        AS todam,
	      
	            --CAST(src.TotalNetPrice * src.CurrencyRate AS  DECIMAL(18, 0)) AS tbill,
	     cast( cast( CASE 
	            WHEN inp = '7' THEN src.CustomWeight
	            ELSE NULL
	       END       as decimal(23,8)) as nvarchar(23))                AS tonw,
	       --CASE 
	       --     WHEN src.inp = '7' THEN CAST(
	       --              CAST(
	       --                  ROUND(src.TotalNetPrice * src.CurrencyRate, 0) AS DECIMAL(18, 0)
	       --              ) AS NVARCHAR(18)
	       --          )
	       --     ELSE NULL
	       --END                        AS torv,
	       --CASE 
	       --     WHEN src.inp = '7' THEN CAST(CAST(src.TotalNetPrice AS DECIMAL(36, 4)) AS NVARCHAR(18))
	       --     ELSE NULL
	       --END                        AS tocv,
	      /* CASE WHEN src.DocumentName <> 'Invoice' THEN '1'						-- برای همه انواع غیر از فاکتور فروش نوع تسویه نقدی
	   WHEN src.inp = 7 THEN '1'										--  اگر نوع صادراتی باشد نقدی
	            WHEN ecfd.EntityID IS NOT NULL THEN '1'							-- در صورتی که فاکتور باشد و مصرف کننده نهایی باشد نوع تسویه نقدی
	            WHEN ISNULL(src.NonReceived,0) <> src.TotalNetPrice THEN '1'	-- اگر قسمتی از فاکتور هم دریافت شده باشد نقدی
	            WHEN ISNULL(src.NonReceived,0) = src.TotalNetPrice THEN '2'		-- اگر کل مبلغ فاکتور دریافت نشده باشد به صورت نسیه 
	       END*/
	       CAST(src.Settellment AS NVARCHAR(10)) AS setm,
	       Null                       AS cap,
	       NULL                       AS insp,
	       NULL                       AS tvop,
	       NULL                       AS Tax17,
	       StuffUniqueTaxID           AS sstid,
	       s.Title                    AS sstt,
	       CAST(src.MainQuantity AS DECIMAL(21, 8))  AS am,
	       mu.TaxCode                 AS mu,
	     cast( cast( CASE 
	            WHEN inp = '7' THEN src.RowWeight
	            ELSE NULL
	       END     as decimal(23,8))    as nvarchar (23))                AS nw,
	       case when src.inp = '7' then null else 
		   CAST(CAST(src.Fee * CAST(src.CurrencyRate as FLOAT) AS DECIMAL(26, 8)) AS NVARCHAR(26)) end AS fee,
	      case when src.inp = '7' then  CAST(CAST(src.Fee AS DECIMAL(19, 4)) AS NVARCHAR(26)) else null end AS cfee,
	       src.CurrencyISOCode                      AS cut,
	       '1'                        AS exr,
	       CASE 
	            WHEN src.inp = '7' THEN 
	                     CAST(
	                         ROUND(src.NetPrice * src.CurrencyRate, 0) AS DECIMAL(18, 0)
	                     ) 
	            ELSE NULL
	       END                        AS ssrv,
	       CASE 
	            WHEN src.inp = '7' THEN CAST(src.NetPrice AS DECIMAL(36, 4)) 
	            ELSE NULL
	       END                        AS sscv,
	       case when src.inp = '7' then null else CAST(round(src.Price * src.CurrencyRate,0) AS DECIMAL(18, 0))  end AS prdis,
	       case when src.inp = '7' then null else CAST(round(src.Discount*src.currencyrate,0) AS DECIMAL(18, 0)) end AS dis,
	       case when src.inp = '7' then null else CAST(Round((src.Price - src.Discount)*src.CurrencyRate,0) AS DECIMAL(18, 0))    end    AS adis,
	       CASE WHEN src.inp = '7' THEN '0' ELSE 
	       CAST(
	           CAST(
	               CASE 
	                    WHEN ISNULL(s.ExemptOfSellVat, 0) = 1 THEN 0
	                    WHEN ISNULL(s.IsSpecialStuff, 0) = 1 THEN ISNULL(s.TaxRate, 0) + ISNULL(s.DutyRate, 0)
	                    WHEN ISNULL(src.vat, 0) = 0
	                         AND src.inp = '4' THEN 0
	                        ELSE ISNULL(vr.TaxRate, 0) + ISNULL(vr.DutyRate, 0)
	                   END AS DECIMAL(18, 0)
	           ) AS NVARCHAR(18)
	       )       end                   AS vra,
	       CAST(round(CASE WHEN inp = '4' then src.Vat else src.Vat*src.CurrencyRate end,0) AS DECIMAL(18, 0))  AS vam,
	       '0'                        AS odt,
	       '0'                        AS odr,
	       '0'                        AS odam,
	       '0'                        AS olt,
	       '0'                        AS olr,
	       '0'                        AS olam,
	       '0'                        AS consfee,
	       '0'                        AS spro,
	       '0'                        AS bros,
	       '0'                        AS tcpbs,
	       '0'                        AS cop,
	       '0'                        AS vop,
	       NULL                        AS bsrn,
	       CAST(CASE WHEN inp = 4 then src.NetPrice else  round(src.NetPrice * src.Currencyrate,0) End AS BIGINT)      AS tsstam,	       
	       CAST(src.NetPrice  AS BIGINT)      AS NetPriceInCurrency,
	       '0'                        AS iinn,
	       '0'                        AS acn,
	       '0'                        AS trmn,
	       '0'                        AS pmt,
	       '0'                        AS trn,
	       '0'                        AS pcn,
	       '0'                        AS pid,
	       '0'                        AS pdt,
	       '0'                        AS pv
	INTO   #MyTemp
	FROM   #SourceData                     AS src
	       JOIN CFG.Party             AS p
	            ON  src.PartyID = p.PartyID
	       LEFT JOIN STF.[Stuff]      AS s
	            ON  src.StuffID = s.StuffID
	       LEFT JOIN STF.MeasureUnit  AS mu
	            ON  s.MainMeasureUnitID = mu.MeasureUnitID
	       LEFT JOIN (
	                SELECT ROW_NUMBER() OVER(PARTITION BY a.PartyID ORDER BY a.IsMain DESC) rno,
	                       a.ZipCode,
	                       a.PartyID
	                FROM   CFG.[Address] AS a
	            ) adrss
	            ON  p.PartyID = adrss.PartyID
	            AND adrss.rno = 1
	       JOIN ACC.VatRate           AS vr
	            ON  vr.FinancialPeriodID = src.FinancialPeriodID
	       LEFT JOIN #ContractUniqueTax cut
	            ON  cut.DocumentID = src.DocumentID
	            AND src.inp = 4
	       LEFT JOIN (
	                SELECT b.EntityID,
	                       b.[Value] AS ServiceUniqueTaxID
	                FROM   CFG.EntityCustomeField a
	                       JOIN CFG.EntityCustomeFieldData b
	                            ON  a.EntityCustomeFieldID = b.EntityCustomeFieldID
	                WHERE  a.FieldName = 'ServiceUniqueTaxID'
	            ) ServiceUniqueTax
	            ON  ServiceUniqueTax.EntityID = src.DocumentID
	            AND src.inp = '4'
	      
	       left join (SELECT ecfd.EntityID,ecfd.[Value] FROM cfg.EntityCustomeFieldData AS ecfd 
	       join cfg.EntityCustomeField AS ecf on ecfd.EntityCustomeFieldID = ecf. EntityCustomeFieldID and ecf.FieldName = 'BuyerBranchCode') BuyerBranch
	       on src.PartyID = BuyerBranch.EntityID
	
	--------
	SELECT MAX(mt.taxid)     AS taxid,
	       MAX(mt.Date)      AS [Date],
	       mt.DocumentName,
	       mt.DocumentID,
	       MAX(mt.RowIndex)  AS RowIndex,
	       MAX(mt.indatim)   AS indatim,
	       MAX(mt.Indati2m)  AS Indati2m,
	       MAX(mt.inty)      AS inty,
	       MAX(mt.inno)      AS inno,
	       MAX(mt.irtaxid)   AS irtaxid,
	       MAX(mt.inp)       AS inp,
	       MAX(mt.ins)       AS ins,
	       MAX(mt.tins)      AS tins,
	       MAX(mt.tob)       AS tob,
	       MAX(mt.bid)       AS bid,
	       MAX(mt.tinb)      AS tinb,
	       MAX(mt.sbc)       AS sbc,
	       MAX(mt.bpc)       AS bpc,
	       MAX(mt.bbc)       AS bbc,
	       MAX(mt.ft)        AS ft,
	       MAX(mt.bpn)       AS bpn,
	       MAX(mt.scln)      AS scln,
	       MAX(mt.scc)       AS scc,
	       MAX(mt.crn)       AS crn,
	       MAX(mt.billid)    AS billid,
	       CAST(sum(mt.prdis) as NVARCHAR(18))    AS tprdis,
	       CAST(sum(mt.dis) As NVARCHAR(18))      AS tdis,
	       CAST(sum(mt.adis) as NVARCHAR(18))     AS tadis,
	       CAST (Sum(mt.vam) as NVARCHAR(18))      AS tvam,
	       Max(mt.todam)     AS todam,
	     cast( case when inp = '7' then sum(ssrv) else   sum(mt.tsstam) end AS NVARCHAR(18))   AS tbill,
	       MAX(mt.setm)      AS setm,
	       MAX(mt.cap)       AS cap,
	       MAX(mt.insp)      AS insp,
	       MAX(mt.tvop)      AS tvop,
	       MAX(mt.Tax17)     AS tax17,
	       MAX(mt.cdcn)      AS cdcn,
	       MAX(mt.cdcd)      AS cdcd,
	       MAX(mt.tonw)      AS tonw,
	       cast(sum(mt.ssrv) as nvarchar(18))     AS torv,
	     CASE WHEN mt.inp = '7' then  sum(mt.sscv) else Null End      AS tocv
	INTO   #headResult
	FROM   #MyTemp           AS mt
	GROUP BY
	       mt.DocumentName,
	       mt.DocumentID,
		   mt.inp;
	
	update #headResult
	set
	tprdis = null,
	tdis = null,
	tadis= null,
	tvam = null,
	todam = null,
	tbill = null
	where ins = 3

	DECLARE @result TABLE
	(
		DocName NVARCHAR(MAX) NOT NULL,
		DocId INT NOT NULL,
		RowIndex BIGINT NOT NULL,
		RowInfo NVARCHAR(MAX) NOT NULL,
		DocumentDate DATETIME NOT NULL,
		TaxDataID INT NULL,
		Uuid UNIQUEIDENTIFIER NOT NULL
	);
	
	DECLARE @taxId        NVARCHAR(500),
	        @docName      NVARCHAR(MAX),
	        @RowIndex     BIGINT,
	        @docId        INT,
	        @Date         DATETIME;
	
	DECLARE db_cursor CURSOR 
	FOR
	    SELECT hr.taxid,
	           hr.DocumentName,
	           hr.DocumentID,
	           hr.RowIndex,
	           hr.Date
	    FROM   #headResult AS hr;
	OPEN db_cursor;
	FETCH NEXT FROM db_cursor
	INTO @taxId,
	   @docName,
	   @docId,
	   @RowIndex,
	   @Date;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @headInfo      NVARCHAR(MAX),
            @itemInfos     NVARCHAR(MAX),
            @payments      NVARCHAR(MAX),
            @rowInfo       NVARCHAR(MAX),
            @taxDataId     INT,
            @uid           UNIQUEIDENTIFIER;
    
    SELECT @taxDataId = td.TaxDataID,
           @uid = td.UID
    FROM   CFG.TaxData AS td
    WHERE  td.DocumentName = @docName
           AND td.DocumentID = @docId;
    
    IF @uid IS NULL
        SET @uid = NEWID();
    
    SET @headInfo = (
            SELECT hr.taxid,
                   hr.indatim,
                   hr.Indati2m,
                   hr.inty,
                   hr.inno,
                   hr.irtaxid,
                   hr.inp,
                   hr.ins,
                   hr.tins,
                   hr.tob,
                   hr.bid,
                   hr.tinb,
                   hr.sbc,
                   hr.bpc,
                   hr.bbc,
                   hr.ft,
                   hr.bpn,
                   hr.scln,
                   hr.scc,
				   hr.cdcn,
				   hr.cdcd,
                   hr.crn,
                   hr.billid,
                   hr.tprdis,
                   hr.tdis,
                   hr.tadis,
                   hr.tvam,
                   hr.todam,
                   hr.tbill,
                   hr.setm,
                   hr.cap,
                   hr.insp,
                   hr.tvop,
                   hr.tax17,
                   hr.tocv,
                   hr.torv,
                   hr.tonw
            FROM   #headResult AS hr
            WHERE  hr.DocumentName = @docName
                   AND hr.DocumentID = @docId
                       FOR JSON AUTO, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
        );
    
    IF NOT EXISTS
       (
           SELECT 1
           FROM   #headResult AS hr
           WHERE  hr.DocumentName = @docName
                  AND hr.DocumentID = @docId
                  AND hr.ins = '3'
       )
    BEGIN
        SET @itemInfos = (
                SELECT bd.sstid,
                       bd.sstt,
                       bd.mu,
                       CAST (bd.am as NVARCHAR(18)) am,
                       bd.fee,
                       bd.cfee,
                       bd.cut,
                       bd.exr,
                       CAST(bd.prdis as NVARCHAR(18)) prdis,
                       CAST(bd.dis as NVARCHAR(18)) dis,
                       CAST(bd.adis as NVARCHAR(18)) adis,
                       bd.vra,
                       CAST(bd.vam as NVARCHAR(18)) vam,
                       bd.odt,
                       bd.odr,
                       bd.odam,
                       bd.olt,
                       bd.olr,
                       bd.olam,
                       bd.consfee,
                       bd.spro,
                       bd.bros,
                       bd.tcpbs,
                       bd.cop,
                       bd.vop,
                       bd.bsrn,
                       CAST(bd.tsstam as NVARCHAR(18)) tsstam,
                       CAST(bd.sscv as NVARCHAR(18)) sscv ,
                      cast( bd.ssrv as NVARCHAR(18)) ssrv,
                       bd.nw
                FROM   #MyTemp AS bd
                WHERE  bd.DocumentName = @docName
				and cast(bd.am as decimal(21,8)) <> 0
                       AND bd.DocumentID = @docId
                ORDER BY bd.RowNumber
                           FOR JSON AUTO, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
            );
    END;
    ELSE
    BEGIN
    	SET @itemInfos = N' ';
    END;
    SET @rowInfo = N'{"header" :' + @headInfo + N' , "body" : [' + @itemInfos +
        N' ], "payments" : [], "extension": []}';
    
    INSERT @result
      (
        DocName,
        DocId,
        RowInfo,
        RowIndex,
        DocumentDate,
        TaxDataID,
        Uuid
      )
    SELECT @docName,
           @docId,
           @rowInfo,
           @RowIndex,
           @Date,
           @taxDataId,
           @uid;
    
	SET @taxDataId = NULL

    FETCH NEXT FROM db_cursor
    INTO @taxId,
       @docName,
       @docId,
       @RowIndex,
       @Date;
END;

CLOSE db_cursor;
DEALLOCATE db_cursor;

SELECT r.DocName,
       r.RowIndex,
       r.DocId,
       r.RowInfo,
       r.DocumentDate,
       r.TaxDataID,
       r.Uuid
FROM   @result AS r
ORDER BY
       r.RowIndex;

END;
