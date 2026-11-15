
CREATE   PROC CFG.ValidateSendInvoices
(@docInfo StringArrayInput READONLY, @CompanyID INT)
AS
BEGIN
	DECLARE @errors TABLE
	(
		ERROR NVARCHAR(400)
	);
	

	DECLARE @message			NVARCHAR(MAX),
	        @CultureInfo		VARCHAR(10),
	        @CultureNo			VARCHAR(10),
			@ItemTableName		NVARCHAR(MAX),
			@HeaderTableName	NVARCHAR(MAX),
			@Query				NVARCHAR(MAX);        
	        
		SELECT CFG.GetStringPartBySpliter(Val, 1, '#') DocName,
			   CFG.GetStringPartBySpliter(Val, 2, '#') DocID
			   into #SelectedItemInValidate
		FROM   @docInfo
	        
	        
	        
	----Check if Company Information is Compelete
	IF EXISTS
	   (
	       SELECT 1
	       FROM   CFG.CompanyTaxData AS c
	       WHERE  c.CompanyID = @CompanyID
	              AND (c.CSRPrivateKey IS NULL OR c.UniqueTaxID IS NULL)
	   )
	BEGIN
	    INSERT @errors
	      (
	        ERROR
	      )
	    SELECT N'ReportGenerator.Messages.CompanyCSRInfoNotCompleted';
	END;
	
	
	SET @ItemTableName =   cfg.getTempTableName(1)
	SET @HeaderTableName = cfg.getTempTableName(1)
	
	
		---Fetch Data
	EXEC cfg.spTaxDataSource
		@fromDate          = null,
		@toDate            = null,
		@FinancialPeriodID = null,
		@CompanyID         = null,
		@ItemTableName     = @ItemTableName,
		@HeaderTableName   = @HeaderTableName,
		@Selected          = @docInfo
		SELECT *
	INTO   #Stuff
	FROM   stf.VWStuff AS v
	
	EXEC (@Query)
		
	SET @CultureInfo = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @CultureInfo;
	


	CREATE TABLE #ValidationTable
	(
		FullCode               NVARCHAR(50),
		Code                   NVARCHAR(50),
		Number                 INT,
		StuffUniqueTaxID       NVARCHAR(50),
		MeasureUnitTaxCode     NVARCHAR(50),
		MeasureTitle           NVARCHAR(50),
		ParentInvoiceID        INT,
		UniqueTaxID            NVARCHAR(50),
		CustomWeight           DECIMAL(36, 10),
		RowWeight              DECIMAL(36, 10),
		InternalOrExport       INT,
		DocumentID			   INT,
		DocumentItemID         INT,
		DocumentName		   NVARCHAR(MAX),
		ParentInvoiceUniqueTaxID NVARCHAR(50),
		CottageNumber	nvarchar(50),
		CottageDate		DATE,
		Fee             DECIMAL(36,10),
		Vat				DECIMAL(36,10),
		ReturnVat		DECIMAL(36,10)
		

	)

	
	SET @Query = N'	
	INSERT INTO #ValidationTable(
	           FullCode,
	           Code,
	           Number,
	           StuffUniqueTaxID,
	           MeasureUnitTaxCode,
	           MeasureTitle,
	           ParentInvoiceID,
	           UniqueTaxID,
	           CustomWeight,
	           RowWeight,
	           InternalOrExport,
			   DocumentID ,
			   DocumentItemID,
			   DocumentName,
			   ParentInvoiceUniqueTaxID,
			   CottageNumber,
	           CottageDate,
	           Fee,
	           Vat,
	           ReturnVat	)	
	  SELECT s.code,
	         s.StuffCode,
	         htn.Number,
	         i.StuffUniqueTaxID,
	         mu.TaxCode,
	         mu.Title,
	         htn.ParentInvoiceID,
	         td.UniqueTaxID,
	         i.CustomWeight,
	         i.RowWeight,
	         st.[Type],
	         i.DocumentID,
	         i.DocumentItemID,
	         i.DocumentName,
	         htn.ParentInvoiceUniqueTaxID,
			 i.CottageNumber,
			 i.CottageDate,
			 i.Fee,
			 i.Vat,
			 i.ReturnVat
	  FROM   '+@ItemTableName+N'         AS i
	         JOIN '+@HeaderTableName+N'  AS htn
	              ON  htn.DocumentID = i.DocumentID
	              AND htn.DocumentName = i.DocumentName
	         JOIN #Stuff                 AS s
	              ON  s.StuffID = i.StuffID
	         JOIN stf.MeasureUnit        AS mu
	              ON  s.MainMeasureUnitID = mu.MeasureUnitID
	         LEFT JOIN cfg.TaxData       AS td
	              ON  htn.DocumentName = td.DocumentName
	              AND td.DocumentID = htn.DocumentID
	         LEFT JOIN sle.SaleType      AS st
	              ON  htn.SaleTypeID = st.SaleTypeID'

	  EXEC (@Query)
	
	
--StuffWithoutUniqueTaxID
SET @message = NULL

	    SELECT @message =    STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + s.FullCode
	                                      
	                   FROM   #ValidationTable AS s
	                    WHERE  s.StuffUniqueTaxID IS NULL
	                          OR  s.StuffUniqueTaxID = ''
	                              FOR XML PATH('')),1,1,'');
	IF @message IS NOT NULL
			BEGIN
				INSERT @errors
				  (
					ERROR
				  )
				  SELECT N'ReportGenerator.Messages.StuffWithoutUniqueTaxID^' + @message
	        END                              
	      
--------------ReturnInvoice Vat Is More Different From CalculatedVat
	
	
SET @message = NULL

	    SELECT @message =    STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + s.FullCode
	                                      
	                   FROM   #ValidationTable AS s
	                    WHERE  ABS(s.Vat - s.ReturnVat) > 10
	                              FOR XML PATH('')),1,1,'');
	IF @message IS NOT NULL
			BEGIN
				INSERT @errors
				  (
					ERROR
				  )
				  SELECT N'ReportGenerator.Messages.ReturnVatMoreDifferentThanCalculatedVat^' + @message
	        END   	      
	                       
						   

-- StuffWithoutMeasureUniqueTaxID

SET @message = NULL

	SELECT @message = STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + s.MeasureTitle
	                   FROM   #ValidationTable AS s
	                   WHERE  s.MeasureUnitTaxCode IS NULL
	                          OR  s.MeasureUnitTaxCode = ''
	                              FOR XML PATH('') ), 1,1,'');
	 IF @message IS NOT NULL
	 BEGIN
	 	 INSERT @errors
	      (
	        ERROR
	      )		  
	      SELECT N'ReportGenerator.Messages.StuffWithoutMeasureUnitTaxCode^' + @message  
	      	 END    
	      	 
----ReturnInvoiceHasNoBase	
 SET @message = NULL

	SELECT @message =  STUFF(
	            (
	                SELECT DISTINCT
	                        '- ' + CAST(a.Number AS NVARCHAR(20))
					FROM  SLE.ReturnedSaleInvoice a
					join sle.ReturnedSaleInvoiceItem b on a.ReturnedSaleInvoiceID = b.ReturnedSaleInvoiceID
					join #SelectedItemInValidate s on s.DocName = 'ReturnedSaleInvoice' and s.DocID = a.ReturnedSaleInvoiceID
					left join SLE.vwReturnSaleInvoice_Invoice AS c 
						on b.ReturnedSaleInvoiceItemID = c.ReturnedSaleInvoiceItemID

					where c.InvoiceID is null
	                            FOR XML PATH('')),1,1,'');
	                         
	IF @message IS NOT NULL
		BEGIN
	 		INSERT @errors
			(
			ERROR
			)		  
			SELECT  N'ReportGenerator.Messages.ReturnInvoiceHasNoBase^'  + @message  
		 END    	                              
	             	      	 
	      	 
	      	 
	      	 
	
----ParentInvoiceHasNotBeenSent	
 SET @message = NULL

	SELECT @message =  STUFF(
	            (
	                SELECT DISTINCT
	                        '- ' + CAST(s.Number AS NVARCHAR(20))
	                FROM   #ValidationTable AS s
	                WHERE  ISNULL(s.ParentInvoiceID, 0) <> 0
	                        AND ISNULL(s.ParentInvoiceUniqueTaxID, '') = ''
	                            FOR XML PATH('')),1,1,'');
	                              
	IF @message IS NOT NULL
		BEGIN
	 		INSERT @errors
			(
			ERROR
			)		  
			SELECT  N'ReportGenerator.Messages.ParentInvoiceHasNotBeenSent^'  + @message  
		 END    	                              
	                              
	                              
	----ReturnInvoiceHasMoreThan1Invoice
	
SET @message = NULL
 SELECT @message= STUFF(
	        (
	            SELECT DISTINCT
	                   '- ' + CAST(rsi.Number AS NVARCHAR(20))
	            FROM   (
	                       SELECT src.ReturnedSaleInvoiceID
	                       FROM   (
	                                  SELECT vrsii.ReturnedSaleInvoiceID,
	                                         vrsii.InvoiceID
	                                  FROM   #ValidationTable a
	                                         JOIN SLE.vwReturnSaleInvoice_Invoice AS vrsii
	                                              ON  a.DocumentID = vrsii.ReturnedSaleInvoiceID
	                                         JOIN SLE.ReturnedSaleInvoice AS rsi
	                                              ON  rsi.ReturnedSaleInvoiceID = vrsii.ReturnedSaleInvoiceID
	                                  WHERE  a.DocumentName = 'ReturnedSaleInvoice'
	                                  GROUP BY
	                                         vrsii.ReturnedSaleInvoiceID,
	                                         vrsii.InvoiceID
	                              ) src
	                       GROUP BY
	                              src.ReturnedSaleInvoiceID
	                       HAVING COUNT(*) > 1
	                   ) src1
	                   JOIN sle.ReturnedSaleInvoice AS rsi
	                        ON  rsi.ReturnedSaleInvoiceID = src1.ReturnedSaleInvoiceID
	                            FOR XML PATH('')),1,1,'');
		IF @message IS NOT NULL 
		
		BEGIN
	
			INSERT @errors	(ERROR)
			SELECT N'ReportGenerator.Messages.ReturnInvoiceHasMoreThan1Invoice^' + @message	

		END
----ReturnInvoiceItemHasMoreThan1Invoice
	
SET @message = NULL
 SELECT @message= STUFF(
	        (
	            SELECT DISTINCT
	                    '- ' + CAST(rsi.Number AS NVARCHAR(20))
	                    FROM
	                     (
	                     SELECT vrsii.ReturnedSaleInvoiceItemID FROM  #ValidationTable a
	                    JOIN SLE.vwReturnSaleInvoice_Invoice AS vrsii
	                        ON  a.DocumentItemID = vrsii.ReturnedSaleInvoiceItemID
	            WHERE  a.DocumentName = 'ReturnedSaleInvoice'
	            GROUP BY
	                    vrsii.ReturnedSaleInvoiceItemID
	                     HAVING COUNT(*) > 1
	                     ) src
	                     JOIN sle.ReturnedSaleInvoiceItem AS rsii ON src.ReturnedSaleInvoiceItemID = rsii.ReturnedSaleInvoiceItemID
	                     JOIN sle.ReturnedSaleInvoice AS rsi ON rsi.ReturnedSaleInvoiceID = rsii.ReturnedSaleInvoiceID
	                    
	            
	                    FOR XML PATH('')),1,1,'');
		IF @message IS NOT NULL 
		
		BEGIN
	
			INSERT @errors	(ERROR)
			SELECT N'ReportGenerator.Messages.ReturnInvoiceHasMoreThan1Invoice^' + @message	

		END		

	----ReturnInvoiceHasNoInvoice
	SET @message = NULL
	SET @message =  STUFF(
	            (
	                SELECT DISTINCT
	                        '- ' + CAST(rsi.Number AS NVARCHAR(20))
	                FROM   #ValidationTable a
	                        JOIN SLE.vwReturnSaleInvoice_Invoice AS vrsii
	                            ON  a.DocumentID = vrsii.ReturnedSaleInvoiceID
	                        JOIN SLE.ReturnedSaleInvoice AS rsi
	                            ON  rsi.ReturnedSaleInvoiceID = vrsii.ReturnedSaleInvoiceID
	                WHERE  a.DocumentName = 'ReturnSaleInvoice'
	                        AND vrsii.InvoiceID IS NULL
	                            FOR XML PATH('')),1,1,'');
	                            
		IF @message IS NOT NULL 
		
		BEGIN
	
			INSERT @errors	(ERROR)
			SELECT N'ReportGenerator.Messages.ReturnInvoiceHasNoInvoice^' + @message
		END                            
	                            

	
	----ExportInvoiceRowsHasNoWeight
	SET @message = NULL

	     SELECT @message =  STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + CAST(a.Number AS NVARCHAR(20))
	                   FROM   #ValidationTable a
	                   WHERE  InternalOrExport = 0
	                          AND a.RowWeight = 0
	                              FOR XML PATH('')),1,1,'');
		IF @message IS NOT NULL
			BEGIN
					 INSERT @errors( ERROR ) 
			 SELECT N'ReportGenerator.Messages.ExportInvoiceRowsHasNoWeight^' + @message                           
	END                              

	----ExportInvoiceHeaderHasNoWeight
	SET @message = NULL
		
	SELECT @message = 	 STUFF(
	        (
	            SELECT DISTINCT
	                    '- ' + CAST(i.Number AS NVARCHAR(20))
	            FROM   #ValidationTable AS st
	                    JOIN sle.Invoice AS i
	                        ON  st.DocumentID = i.InvoiceID AND st.DocumentName = 'Invoice'
	                    JOIN sle.SaleType AS st2
	                        ON  st2.SaleTypeID = i.SaleTypeID
	                    LEFT JOIN cfg.EntityCustomeField AS ecf
	                        ON  ecf.EntityName = 'Invoice'
	                        AND ecf.FieldName = 'CustomWeight'
	                    LEFT JOIN cfg.EntityCustomeFieldData AS ecfd
	                        ON  i.InvoiceID = ecfd.EntityID
	                        AND ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
	            WHERE  st2.[Type] = 0
	                    AND ecfd.EntityCustomeFieldDataID IS NULL
	                        FOR XML PATH('')),1,1,'');
	IF @message IS NOT NULL
		BEGIN
				 INSERT @errors( ERROR ) 	
				 SELECT N'ReportGenerator.Messages.ExportInvoiceHasNoWeight^'+ @message
		END                        
	
	----SumRowsWeightIsDifferentFromHeaderWeight
	SET @message = NULL
		
	SELECT @message =   STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + CAST(st.Number AS NVARCHAR(20))
	                   FROM   #ValidationTable AS st
	                   WHERE  InternalOrExport = 0
	                   GROUP BY
	                          st.Number
	                   HAVING SUM(st.RowWeight) <> MAX(st.CustomWeight)
	                          FOR XML PATH('')),1,1,'');
	
		IF @message IS NOT NULL
			BEGIN
					 INSERT @errors( ERROR ) 
					 SELECT  N'ReportGenerator.Messages.SumRowsWeightIsDifferentFromHeaderWeight^' + @message
			END

----CottageDateOrCottageNumberIsNotSpecified
	SET @message = NULL
		
	SELECT @message =   STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + CAST(st.Number AS NVARCHAR(20))
	                   FROM   #ValidationTable AS st
	                   WHERE  InternalOrExport = 0 and (CottageNumber is Null or CottageDate is null)
	                   GROUP BY   st.Number FOR XML PATH('')),1,1,'');
	
		IF @message IS NOT NULL
			BEGIN
					 INSERT @errors( ERROR ) 
					 SELECT  N'ReportGenerator.Messages.CottageDateOrCottageNumberIsNotSpecified^' + @message
			END


--- fee is not correct

	SET @message = NULL
		
	SELECT @message =   STUFF(
	               (
	                   SELECT DISTINCT
	                          '- ' + CAST(st.Number AS NVARCHAR(20))
	                   FROM   #ValidationTable AS st
	                   WHERE  Fee = 0  
	                   GROUP BY   st.Number FOR XML PATH('')),1,1,'');
	
		IF @message IS NOT NULL
			BEGIN
					 INSERT @errors( ERROR ) 
					 SELECT  N'ReportGenerator.Messages.FeeCanNotBeZero^' + @message
			END

	
	SELECT e.Error
	FROM   @errors AS e;
END;
