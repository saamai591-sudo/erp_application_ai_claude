------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [CTM].RptReception_ConsumablePartsReview
	@FromDate DATE,
	@ToDate DATE,
	@Branches NVARCHAR(MAX) = NULL,
	@Receptions NVARCHAR(MAX) = NULL,
	@Customers NVARCHAR(MAX) = NULL,
	@Dls NVARCHAR(MAX) = NULL,
	@Stuffs NVARCHAR(MAX) = NULL
	
	--WITH ENCRYPTION 
AS
BEGIN

	DECLARE @UserID INT ,
    @DateType TINYINT ,
    @DateFormat VARCHAR(10) ,
    @Culture VARCHAR(10),
	@CultureNo tinyint

SET @Culture = CFG.GetuserCulture();

SET @UserID = CFG.GetuserID();


	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	
SELECT  @DateType = us.SettingValue
FROM    CFG.UserSetting us
WHERE   us.SettingKey = 'Date_Type'
        AND us.UserID = @UserID;
	
IF @DateType IS NULL
    SET @DateType = CASE @Culture
                      WHEN 'fa' THEN 0
                      WHEN 'en' THEN 1
                      WHEN 'ar' THEN 2
                    END;
	
SELECT  @DateFormat = us.SettingValue
FROM    CFG.UserSetting us
WHERE   us.SettingKey = 'Date_Format'
        AND us.UserID = @UserID;
	
IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';


	SELECT ROW_NUMBER() OVER(ORDER BY a.TemporaryOutgoingItemID) Id,
	       a.[Type],
		   a.DocType,
		   a.DocID,
	       a.TemporaryOutgoingItemID,
	       a.StuffID,
	       s.Code      StuffCode,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StuffTitle,
		   a.[Date],
	       CFG.GetCLRSaturnDate( a.[Date],@DateFormat,0,@DateType) Date_Date,
	       a.Number BaseNumber,
	       ISNULL(a.MainQuantity,0) MainQuantity,
	       ISNULL(a.SubQuantity ,0) SubQuantity ,
	       a.ReceptionID,
	       a.[Description],
	       a.Description2
	FROM   (
	           SELECT 'حواله موقت' [Type],
					  'TemporaryOutgoing' DocType,
					  to1.TemporaryOutgoingID DocID,
	                  toi.TemporaryOutgoingItemID,
	                  toi.StuffID,
	                  toi.MainQuantity,
	                  toi.SubQuantity,
	                  toi.ReceptionID,
	                  toi.[Description],
	                  toi.Description2,
	                  to1.StockID,
	                  to1.Date,
	                  to1.Number
	           FROM   STC.TemporaryOutgoing to1
	                  INNER JOIN STC.TemporaryOutgoingItem toi
	                       ON  toi.TemporaryOutgoingID = to1.TemporaryOutgoingID
	           WHERE  (
	                      @Dls IS NULL
	                      OR to1.DlID IN (SELECT VALUE
	                                      FROM   CFG.R_FnCommaStr2Table(@Dls))
	                  )
	           
	           UNION ALL
	           SELECT 'برگشت حواله موقت' [Type],
					  'ReturnedTemporaryOutgoing' DocType,
					  rto.ReturnedTemporaryOutgoingID DocID,
	                  rtoi.TemporaryOutgoingItemID,
	                  toi.StuffID,
	                  rtoi.MainQuantity,
	                  rtoi.SubQuantity,
	                  toi.ReceptionID,
	                  rtoi.[Description],
	                  rtoi.Description2,
	                  rto.StockID,
	                  rto.Date,
	                  rto.Number
	           FROM   STC.ReturnedTemporaryOutgoing rto
	                  INNER JOIN stc.ReturnedTemporaryOutgoingItem rtoi
	                       ON  rtoi.ReturnedTemporaryOutgoingID = rto.ReturnedTemporaryOutgoingID
	                  INNER JOIN STC.TemporaryOutgoingItem toi
	                       ON  toi.TemporaryOutgoingItemID = rtoi.TemporaryOutgoingItemID
	                  INNER JOIN STC.TemporaryOutgoing to2
	                       ON  to2.TemporaryOutgoingID = toi.TemporaryOutgoingID
	           WHERE  (
	                      @Dls IS NULL
	                      OR to2.DlID IN (SELECT VALUE
	                                      FROM   CFG.R_FnCommaStr2Table(@Dls))
	                  )
	           
	           UNION ALL
	           SELECT 'حواله انبار' [Type],
					  'Outgoing' DocType,
					  o.OutgoingID DocID,
	                  oi.TemporaryOutgoingItemID,
	                  oi.StuffID,
	                  oi.MainQuantity,
	                  oi.SubQuantity,
	                  toi.ReceptionID,
	                  oi.[Description],
	                  oi.Description2,
	                  o.StockID,
	                  o.Date,
	                  o.Number
	           FROM   STC.Outgoing o
			   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	                  INNER JOIN STC.OutgoingItem oi
	                       ON  oi.OutgoingID = o.OutgoingID
	                  INNER JOIN stc.TemporaryOutgoingItem toi
	                       ON  toi.TemporaryOutgoingItemID = oi.TemporaryOutgoingItemID
	           WHERE  sdtb.BaseEntity = 7
	           
	       )        AS a
	       INNER JOIN STF.[Stuff] s
	            ON  s.StuffID = a.StuffID
	            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = a.StockID
	WHERE    (
	               @Receptions IS NULL
	               OR a.ReceptionID IN (SELECT VALUE
	                                    FROM   cfg.R_FnCommaStr2Table(@Receptions))
	           )
	       AND (
	               @Stuffs IS NULL
	               OR a.StuffID IN (SELECT VALUE
	                                FROM   CFG.R_FnCommaStr2Table(@Stuffs))
	           )
END




