

CREATE VIEW [APS].[DimSaleBaseDocument]
AS 

SELECT CAST(id AS TINYINT)     Id,
       title
FROM   (
           SELECT CAST(1 AS TINYINT)     Id,
                  N'بدون مبنا'        AS Title
           UNION
           SELECT 2         AS Id,
                  N'سفارش'  AS Title
           UNION
           SELECT 3             AS Id,
                  N'مجوز فروش'  AS Title
           UNION
           SELECT 4              AS Id,
                  N'پیش فاکتور'  AS Title
           UNION
           SELECT 5              AS Id,
                  N'حواله فروش'  AS Title
           UNION
           SELECT 6          AS Id,
                  N'فاکتور'  AS Title
           UNION
           SELECT 7                   AS Id,
                  N'مجوز برگشت فروش'  AS Title
           UNION
           SELECT 8              AS Id,
                  N'برگشت فروش'  AS Title
           UNION
           SELECT 9               AS Id,
                  N'حواله انبار'  AS Title
           UNION
           SELECT 10        AS Id,
                  N'پذیرش'  AS Title
           UNION
           SELECT 11          AS Id,
                  N'قرارداد'  AS Title
           UNION
           SELECT 12             AS Id,
                  N'صورت وضعیت'  AS Title
           UNION
           SELECT 13              AS Id,
                  N'فروش دارایی'  AS Title
		   UNION
           SELECT 14              AS Id,
                  N'قرارداد فروش'  AS Title
		   UNION
           SELECT 15              AS Id,
                  N'برگشت حواله'  AS Title
       )                       T
