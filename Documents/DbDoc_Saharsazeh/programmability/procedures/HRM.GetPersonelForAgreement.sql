

CREATE   PROC HRM.GetPersonelForAgreement
    (
        @Type INT,
        @IssueDate date,
        @date DATE,
	    @branchId INT
    )
    --WITH ENCRYPTION
    AS
    BEGIN

    DECLARE @CultureNo TINYINT,
	        @Culture NVARCHAR(10);
	
	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;

        SELECT ps.StatusType
        INTO #ValidTypes
        FROM HRM.AgreementTypePrePersonelStatus AS atpps
            INNER JOIN HRM.PersonelStatus AS ps
                ON ps.PersonelStatusID = atpps.PersonelStatusID
        WHERE atpps.AgreementTypeID = @Type;

        DECLARE @ChangeBranchNeedLeavingWork BIT;

        SELECT @ChangeBranchNeedLeavingWork = CASE LOWER(c.ConfigValue)
                                                  WHEN 'true' THEN
                                                      1
                                                  ELSE
                                                      0
                                              END
        FROM CFG.Configuration AS c
        WHERE c.ConfigKey = 'ChangeBranchNeedLeavingWork';

        DECLARE @UserId INT,
        @CompanyID int;
        SET @UserId = CFG.GetuserID();
        
        SELECT @CompanyID = b.CompanyID FROM cfg.Branch AS b
        join cfg.Company AS c on c.CompanyID = b.CompanyID
        WHERE b.BranchID = @branchId
        

        SELECT C.PersonelID,
               ISNULL(C.STATUS, 100) AS [Status],
               C.PartyID,
               C.Code
        INTO #T
        FROM
        (
            SELECT p.PersonelID,
                   [STATUS],
                   p.Code,
                   p.PartyID
            FROM HRM.Personel AS p
                LEFT JOIN
                (
                    SELECT HRM.ChangePersonelStatus.PersonelID,
                           HRM.ChangePersonelStatus.[STATUS],
                           ROW_NUMBER() OVER (PARTITION BY PersonelID ORDER BY IssueDate DESC) AS Rno
                    FROM HRM.ChangePersonelStatus
                    WHERE ChangeDate <= @date
                ) T
                    ON p.PersonelID = T.PersonelID
            WHERE  p.CompanyID = @CompanyID and ISNULL(Rno, 1) = 1
                  AND ISNULL([STATUS], 100)
                  IN
                      (
                          SELECT StatusType FROM #ValidTypes
                      )
                      AND NOT EXISTS (SELECT 1 FROM hrm.Agreement AS a WHERE a.IssueDate>= @IssueDate
                      AND a.PersonelID=p.PersonelID
                      )
                      AND NOT EXISTS (SELECT 1 FROM hrm.ChangePersonelStatus AS cps
                                      WHERE cps.ChangeDate>= @date AND cps.PersonelID = p.PersonelID AND cps.[STATUS] = 3 )
      ) C;
    
   
       SELECT * into #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba

        SELECT #T.PersonelID,
               #T.PartyID,
               #T.Code,
               Agg.AgreementID,               
           case @CultureNo WHEN 2 THEN 
                pa.Title2 + ' ' + ISNULL(pa.LastName2, '')
           ELSE 
                pa.Title + ' ' + ISNULL(pa.LastName, '')
           END AS FullName
        FROM #T
            INNER JOIN CFG.Party pa
                ON #T.PartyID = pa.PartyID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno,
                       a.BranchID,
                       a.PersonelID,
                       a.AgreementID
                FROM HRM.Agreement AS a
                    INNER JOIN #vwBranchAccess AS vba
                        ON vba.BranchID = a.BranchID
            ) Agg
                ON Agg.PersonelID = #T.PersonelID
                   AND Agg.Rno = 1
        WHERE #T.[Status] IN ( 100, 3 )
              OR
              (
                  #T.[Status] NOT IN ( 100, 3 )
                  AND
                  (
                      @ChangeBranchNeedLeavingWork = 0
                      OR Agg.BranchID = @branchId
                  )
              );

    END;

