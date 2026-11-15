
-------------------------------------
CREATE   PROC ATN.UpdateAttendanceCalculationMethodFormulaParameters
(
    @AttendanceCalculationMethodFormulaID INT,
    @expr NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    IF (@expr IS NULL OR LTRIM(RTRIM(@expr)) = '')
        RETURN;

    ;WITH Occ AS (
        -- موقعیت شروع تمام رخدادهای 'PP' در رشته، به ترتیب
        SELECT
            CAST(CHARINDEX('PP', @expr, 1) AS INT) AS StartPos,
            CAST(1 AS INT) AS OccNum
        WHERE CHARINDEX('PP', @expr, 1) > 0

        UNION ALL

        SELECT
        CAST(
            CHARINDEX(
                'PP',
                @expr,
                CASE 
                    WHEN OccNum % 2 = 1 THEN StartPos + 1
                    ELSE StartPos + 2
                END
            ) AS INT
        ) AS StartPos,
        CAST(OccNum + 1 AS INT) AS OccNum
        FROM Occ
        WHERE CHARINDEX('PP', @expr,
                CASE WHEN OccNum % 2 = 1 THEN StartPos + 1
                     ELSE StartPos + 2 END) > 0
    ),
    Pairs AS (
        -- هر دو رخداد متوالی فرد-زوج (۱و۲، ۳و۴، ...) یک توکن می‌سازند
        SELECT
            o1.StartPos AS StartPP,
            o2.StartPos AS EndPP
        FROM Occ o1
        JOIN Occ o2 ON o2.OccNum = o1.OccNum + 1
        WHERE o1.OccNum % 2 = 1
    ),
    Tokens AS (
        SELECT SUBSTRING(@expr, StartPP + 2, EndPP - StartPP - 2) AS Token
        FROM Pairs
    ),
    Parsed AS (
        SELECT
            Token,
            LEN(Token) - LEN(REPLACE(Token, '_', '')) + 1 AS PartCount,
            REPLACE(Token, '_', '.') AS DottedToken   -- برای استفاده از PARSENAME
        FROM Tokens
        WHERE Token IS NOT NULL AND Token <> ''
    ),
    Params AS (
        SELECT DISTINCT
            CAST(PARSENAME(DottedToken, PartCount) AS INT) AS ParameterValueType,
            CASE WHEN PartCount = 4 THEN CAST(PARSENAME(DottedToken, 3) AS INT) END AS Parameter,
            CASE WHEN PartCount IN (3, 4) THEN CAST(PARSENAME(DottedToken, 2) AS INT) END AS Category,
            CASE WHEN PartCount >= 2 THEN CAST(PARSENAME(DottedToken, 1) AS INT) END AS ParameterType
        FROM Parsed
        WHERE PartCount BETWEEN 1 AND 4   -- نسخه‌ی اصلی هم فقط Count صفر تا سه (=PartCount ۱ تا ۴) رو هندل می‌کرد
    )
    INSERT INTO ATN.AttendanceCalculationMethodFormulaParameter
        (AttendanceCalculationMethodFormulaID, ParameterType, Category, ParameterValueType,
         Version, Creator, CreationDate, LastEditor, LastEditionDate, Parameter)
    SELECT
        @AttendanceCalculationMethodFormulaID, p.ParameterType, p.Category, p.ParameterValueType,
        0, -1, GETDATE(), -1, GETDATE(), p.Parameter
    FROM Params p
    WHERE p.ParameterType IS NOT NULL   -- شرط اصلی: هم ParameterType هم ParameterValueType باید NOT NULL باشند
      AND p.ParameterValueType IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM ATN.AttendanceCalculationMethodFormulaParameter fp
          WHERE fp.AttendanceCalculationMethodFormulaID = @AttendanceCalculationMethodFormulaID
            AND fp.ParameterType = p.ParameterType
            AND ((fp.Category  IS NOT NULL AND p.Category  IS NOT NULL AND fp.Category  = p.Category)  OR (fp.Category  IS NULL AND p.Category  IS NULL))
            AND ((fp.Parameter IS NOT NULL AND p.Parameter IS NOT NULL AND fp.Parameter = p.Parameter) OR (fp.Parameter IS NULL AND p.Parameter IS NULL))
            AND fp.ParameterValueType = p.ParameterValueType
      )
    OPTION (MAXRECURSION 1000);   -- سقف پیش‌فرض ۱۰۰ است؛ اگر expr خیلی طولانی با تعداد زیاد PP باشد بالاتر ببرید یا 0 بگذارید
END
