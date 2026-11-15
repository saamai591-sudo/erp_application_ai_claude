----------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [CFG].spRptReserved_Flow
(
    @selectedBranchs NVARCHAR(MAX) = NULL,
    @selectedStuff NVARCHAR(MAX) = NULL,
    @selectedStuffGroup NVARCHAR(MAX) = NULL,
    @selectedStuffSaleGroup NVARCHAR(MAX) = NULL,
    @selectedStuffTrace NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    ----------------------
    DECLARE @reserveBaseForm NVARCHAR(500),
            @consumReserveBaseForm NVARCHAR(500),
            @needConfirm NVARCHAR(10),
            @columns NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @tempTableName NVARCHAR(20),
            @stuffTraceTableName NVARCHAR(20),
            @requestNeedConfirm NVARCHAR(10),
            @joinColumns NVARCHAR(MAX),
            @selectColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @Justification NVARCHAR(100),
            @Quotation NVARCHAR(100),
            @Remittance NVARCHAR(100),
            @Invoice NVARCHAR(100),
            @StuffRequest NVARCHAR(100),
            @Culture VARCHAR(10),
            @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;


    SELECT @reserveBaseForm = c.ConfigValue
    FROM CFG.[Configuration] AS c
    WHERE c.ConfigKey = 'BaseDocumentForReserve';

    SELECT @consumReserveBaseForm = c.ConfigValue
    FROM CFG.[Configuration] AS c
    WHERE c.ConfigKey = 'BaseDocumentForConsumeReserve';


    SET @Culture = CFG.GetuserCulture();
    SET @UserID = CFG.GetuserID();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


   


 
CREATE TABLE  #tempTableName
         
    (
        DocType NVARCHAR(100) ,
        DocID INT ,
        Number INT ,
		Date Date,
        Date_Date NVARCHAR(20) ,
        CutomerTitle NVARCHAR(500) ,
        CustomerCode NVARCHAR(100) ,
        StuffCode NVARCHAR(max) ,
        StuffTitle NVARCHAR(max) ,
        MainQuantity DECIMAL(30, 4) ,
        SubQuantity DECIMAL(30, 4) ,
        DoMainQuantity DECIMAL(30, 4) ,
        DoSubQuantity DECIMAL(30, 4) ,
        Non DECIMAL(30, 4) ,
        SubNon DECIMAL(30, 4)
    );
	

    IF @reserveBaseForm IS NOT NULL
   
   BEGIN
   	        SET @query
            = N'
		INSERT INTO #tempTableName
        SELECT ''' + @reserveBaseForm + N''' AS DocType ,
               ii.' + @reserveBaseForm
              + N'ItemID AS DocID ,
               i.Number ,
			   i.[Date],
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date ,              
			   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then d.Title
	                when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then d.Title2
	           end as CutomerTitle, 
               d.Code AS CustomerCode ,
               s.Code AS StuffCode ,
			   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then s.Title2
	           end as StuffTitle,
               inog.MainQuantity ,
               inog.SubQuantity ,
               inog.DoMainQuantity ,
               CASE WHEN ii.SubQuantity IS NULL THEN NULL
                    ELSE inog.DoSubQuantity
               END DoSubQuantity ,
               inog.Non ,
               CASE WHEN ii.SubQuantity IS NULL THEN NULL
                    ELSE inog.SubNon
               END SubNon
        FROM   SLE.' + @reserveBaseForm
              + N'Item AS ii
               JOIN STF.Stuff AS s ON s.StuffID = ii.StuffID
               JOIN STF.StuffDetail AS sd ON sd.StuffID = ii.StuffID
               JOIN SLE.' + @reserveBaseForm + N' AS i ON i.' + @reserveBaseForm + N'ID = ii.' + @reserveBaseForm
              + N'ID
               JOIN CFG.Party AS p ON p.PartyID = i.CustomerID
               JOIN ACC.DL AS d ON d.DLID = p.DlID
               JOIN SLE.' + @reserveBaseForm + N'_Non_OutGoing AS inog ON inog.' + @reserveBaseForm + N'ItemID = ii.'
              + @reserveBaseForm + N'ItemID
              
        WHERE  inog.Non > 0
               AND i.[Status] <> 2
			   AND (   @selectedBranchs IS NULL
					   OR i.BranchID IN (   SELECT value
											FROM   CFG.R_FnCommaStr2Table(@selectedBranchs) ))
			   AND (   @selectedStuff IS NULL
					   OR ii.StuffID IN (   SELECT value
											FROM   CFG.R_FnCommaStr2Table(@selectedStuff) ))
			   AND (   @selectedStuffGroup IS NULL
					   OR s.StuffGroupID IN (   SELECT value
											FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup) ))
			   AND (   @selectedStuffSaleGroup IS NULL
					   OR sd.SalesGroupID IN (   SELECT value
											FROM   CFG.R_FnCommaStr2Table(@selectedStuffSaleGroup) ))
		';

        PRINT @query;
        EXEC sp_executesql @query,
                           N'@needConfirm			NVARCHAR(10),
						    @selectedBranchs		NVARCHAR(MAX),
							@selectedStuff			NVARCHAR(MAX),
							@selectedStuffGroup		NVARCHAR(MAX),
							@selectedStuffSaleGroup NVARCHAR(MAX),
							@selectedStuffTrace		NVARCHAR(MAX) ,
							@DateType				VARCHAR(10) ,
							@DateFormat				VARCHAR(10)',
                           @needConfirm = @needConfirm,
                           @selectedBranchs = @selectedBranchs,
                           @selectedStuff = @selectedStuff,
                           @selectedStuffGroup = @selectedStuffGroup,
                           @selectedStuffSaleGroup = @selectedStuffSaleGroup,
                           @selectedStuffTrace = @selectedStuffTrace,
                           @DateFormat = @DateFormat,
                           @DateType = @DateType;
    END;

    IF @consumReserveBaseForm IS NOT NULL
    BEGIN

        SELECT @requestNeedConfirm = c.ConfigValue
        FROM [CFG].[Configuration] AS [c]
        WHERE c.ConfigKey = 'Is' + @consumReserveBaseForm + 'Surveyable';

        SET @query
            = N'
		  INSERT INTO ' + @tempTableName
              + N'
		  SELECT   ''StuffRequest'' AS DocType ,
				   sr.StuffRequestID AS DocID ,
				   sr.StuffRequestNumber AS Number ,
				   sr.[StuffRequestDate] AS Date,
				   CFG.GetCLRSaturnDate(sr.[StuffRequestDate], @DateFormat, 0, @DateType) AS Date_Date ,
				   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then ou.Title
	                    when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then ou.Title2
	               end as CutomerTitle, 				   
				   ou.Code AS CustomerCode ,
				   s.Code AS StuffCode ,
				   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                    when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then s.Title2
	               end as StuffTitle,
				   srr.AcceptRequestMainMeasureQuantity MainQuantity ,
				   srr.AcceptRequestSubMeasureQuantity SubQuantity ,
				   srr.DoOutGoing DoMainQuantity ,
				   srr.DoSubOutGoing DoSubQuantity ,
				   srr.NonOutgoing Non ,
				   srr.NonSubOutgoing SubNon ,
				   ' + @selectColumns
              + N'
			FROM   REQ.StuffRequestItem AS ii
				   JOIN STF.VWStuff AS s ON s.StuffID = ii.StuffID
				   JOIN STF.[StuffDetail] AS sd ON sd.StuffID = ii.StuffID
				   JOIN REQ.StuffRequest AS sr ON sr.StuffRequestID = ii.StuffRequestID
				   JOIN CFG.OrganizationUnit AS ou ON ou.OrganizationUnitID = sr.OrganizationUnitID
				   JOIN req.StuffRequest_Remains AS srr ON srr.StuffRequestItemID = ii.StuffRequestItemID
				  
			WHERE  srr.NonOutgoing > 0
				   AND (   srr.NonSubOutgoing IS NULL
						   OR srr.NonSubOutgoing > 0 )
				   AND sr.StuffRequestState <> 3
				   AND sr.StuffRequestState <> 4
				   AND (@requestNeedConfirm = ''false'' or sr.StuffRequestState = 2)
				   AND (   @selectedBranchs IS NULL
						   OR sr.BranchID IN (   SELECT value
												FROM   CFG.R_FnCommaStr2Table(@selectedBranchs) ))
				   AND (   @selectedStuff IS NULL
						   OR ii.StuffID IN (   SELECT value
												FROM   CFG.R_FnCommaStr2Table(@selectedStuff) ))
				   AND (   @selectedStuffGroup IS NULL
						   OR s.StuffGroupID IN (   SELECT value
												FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup) ))
				   AND (   @selectedStuffSaleGroup IS NULL
						   OR sd.SalesGroupID IN (   SELECT value
												FROM   CFG.R_FnCommaStr2Table(@selectedStuffSaleGroup) ))
				   AND  (@SelectedStuffTrace IS NULL OR st.StuffID is not null)';

        PRINT @query;
        EXEC sp_executesql @query,
                           N'@requestNeedConfirm	NVARCHAR(20),
						    @selectedBranchs		NVARCHAR(MAX),
							@selectedStuff			NVARCHAR(MAX),
							@selectedStuffGroup		NVARCHAR(MAX),
							@selectedStuffSaleGroup NVARCHAR(MAX),
							@selectedStuffTrace		NVARCHAR(MAX),
							@DateType				VARCHAR(10) ,
							@DateFormat				VARCHAR(10)',
                           @requestNeedConfirm = @requestNeedConfirm,
                           @selectedBranchs = @selectedBranchs,
                           @selectedStuff = @selectedStuff,
                           @selectedStuffGroup = @selectedStuffGroup,
                           @selectedStuffSaleGroup = @selectedStuffSaleGroup,
                           @selectedStuffTrace = @selectedStuffTrace,
                           @DateType = @DateType,
                           @DateFormat = @DateFormat;
    END;

    SELECT @Justification = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Justification'
          AND lev.Culture = @Culture;

    SELECT @Quotation = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Quotation'
          AND lev.Culture = @Culture;

    SELECT @Remittance = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Remittance'
          AND lev.Culture = @Culture;

    SELECT @Invoice = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Invoice'
          AND lev.Culture = @Culture;

    SELECT @StuffRequest = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'StuffRequest'
          AND lev.Culture = @Culture;

   
   


  
    SET @query
        = N'
SELECT 
ROW_NUMBER() OVER (ORDER BY DocType,DocID) ID,
CASE DocType
            WHEN ''Invoice'' THEN ' + @Invoice + N'
            WHEN ''Remittance'' THEN ' + @Remittance + N'
            WHEN ''Quotation'' THEN ' + @Quotation + N'
            WHEN ''Justification'' THEN ' + @Justification + N'
            WHEN ''StuffRequest'' THEN ' + @StuffRequest + N'
       END AS DocName ,
       * 

FROM    #tempTableName   res

DROP TABLE  #tempTableName';

print @query
    EXEC (@query);
END;
