------------------------------------- START #7164

CREATE   FUNCTION [HRM].[GetActivePersonelSimple]
(
    @Date DATE = NULL,
    @hasVacancyType BIT = NULL
)

RETURNS @Result TABLE 
(
    PersonelID INT NOT NULL,
    PartyID INT NOT NULL,
    Code NVARCHAR(100) NOT NULL,
    FullName NVARCHAR(1024) NOT NULL
)
AS
BEGIN
    DECLARE @Culture NVARCHAR(100),
            @CultureNo TINYINT;

    SET @Culture = cfg.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo 
    WHERE Culture = @Culture;

    IF @Date IS NULL
        SET @Date = GETDATE();

    DECLARE @NeedConfirm BIT;

    SELECT @NeedConfirm = ConfigValue
    FROM cfg.Configuration
    WHERE ConfigKey = 'AgreementNeedConfirm';

    INSERT INTO @Result
    SELECT DISTINCT
        p.PersonelID,
        p.PartyID,
        p.Code,
        p.FullName
    FROM
    (
        SELECT
            p.PersonelID,
            p.PartyID,
            p.Code,
            CASE @CultureNo
                WHEN 1 THEN (pa.Title  + ' ' + ISNULL(pa.LastName,  ''))
                WHEN 2 THEN (pa.Title2 + ' ' + ISNULL(pa.LastName2, ''))
            END AS FullName
        FROM HRM.Personel p
        INNER JOIN CFG.Party pa
            ON p.PartyID = pa.PartyID
        LEFT JOIN
        (
            SELECT *
            FROM
            (
                SELECT *,
                       ROW_NUMBER() OVER
                       (
                           PARTITION BY cps.PersonelID
                           ORDER BY cps.IssueDate DESC
                       ) AS Rno
                FROM hrm.ChangePersonelStatus cps
                WHERE cps.ChangeDate <= @Date
            ) t1
            WHERE Rno = 1
        ) t
            ON t.PersonelID = p.PersonelID
        WHERE t.[Status] = 5
    ) p
    INNER JOIN
    (
        SELECT *,
               ROW_NUMBER() OVER
               (
                   PARTITION BY a.PersonelID
                   ORDER BY a.IssueDate DESC
               ) AS RNo
        FROM hrm.Agreement a
        WHERE a.IssueDate   <= @Date
          AND a.ExecuteDate <= @Date
          AND (
                @NeedConfirm = 0
                OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @Date)
              )
    ) a
        ON a.PersonelID = p.PersonelID
       AND a.RNo = 1
    LEFT JOIN atn.vwPersonelVacancyTypeInMonth v
        ON v.PersonelID = p.PersonelID
    WHERE
        (
            @hasVacancyType IS NULL
            OR @hasVacancyType = 0
            OR v.PersonelID IS NOT NULL
        );

    RETURN;
END
