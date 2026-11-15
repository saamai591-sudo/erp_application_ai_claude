CREATE PROCEDURE [STM].[SpRptPosReceiptShoppingCart]
    (
      @PosReceiptID NVARCHAR(MAX)
    )
AS
    BEGIN
	
        DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10);
			
        SET @Culture = CFG.GetuserCulture();	
        SET @UserID = CFG.GetuserID();
	
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
        IF OBJECT_ID('tempdb..#ids') IS NOT NULL
            DROP TABLE #Ids;
 
        CREATE TABLE #Ids ( id INT );

        INSERT  INTO #Ids
                SELECT  [value]
                FROM    CFG.R_FnCommaStr2Table(@PosReceiptID);

       
        SELECT  N'بن کارت' TypeName ,
                p.Title CustomerName ,
                d.Code CustomerDlCode ,
                pr.[Description] ,
                pr.Number ,
                ss.Title StationShiftTitle ,
                ss.Code StationShiftCode ,
                s.Title StationTitle ,
                s.Code StationCode ,
                pri.Amount ,
                pri.TracingNumber ,
                pr.PosInvoiceID ,
                pit.Number InvoiceNumber ,
                pr.PosReceiptID ,
                pri.ShoppingCartID ,
                u.Name CreatorName ,
                CFG.GetCLRSaturnDate(pr.Date, @DateFormat, 0, @DateType) DateString
        FROM    POS.PosReceipt pr
                JOIN POS.PosReceiptItem pri ON pri.PosReceiptID = pr.PosReceiptID
                JOIN CTM.ShoppingCart c ON c.ShoppingCartID = pri.ShoppingCartID
                JOIN POS.StationShift ss ON ss.StationShiftID = pr.StationShiftID
                JOIN POS.Station s ON s.StationID = ss.StationID
                JOIN CFG.Party p ON p.PartyID = pr.CustomerID
                LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                JOIN CFG.[User] u ON pr.Creator = u.UserID
                LEFT JOIN POS.PosInvoice pit ON pit.PosInvoiceID = pr.PosInvoiceID
        WHERE   pri.ShoppingCartID IS NOT NULL
                AND pr.PosReceiptID IN ( SELECT id
                                         FROM   #Ids ); 

    END;

